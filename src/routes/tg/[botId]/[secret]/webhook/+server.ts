import type { RequestHandler } from "./$types";
import { decryptTextAESGCM } from "$lib/server/crypto";
import { sendMessage, tgCall } from "$lib/server/telegram";
import { mergeConfig, safeJsonParse } from "$lib/server/config";
import { callConnector } from "$lib/server/connectors";

export const POST: RequestHandler = async ({ request, platform, params }) => {
  const env = platform!.env;
  const { botId, secret } = params;

  const bot = await env.DB.prepare(
    "SELECT token_cipher, webhook_path_secret, config_profile_id, is_enabled FROM bots WHERE id=?"
  ).bind(botId).first<any>();

  if (!bot || bot.is_enabled !== 1) return new Response("not found", { status: 404 });

  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== bot.webhook_path_secret && headerSecret !== bot.webhook_path_secret) {
    return new Response("forbidden", { status: 403 });
  }

  const update = await request.json().catch(() => null);
  if (!update) return new Response("bad request", { status: 400 });

  const token = await decryptTextAESGCM(bot.token_cipher, env.BOT_TOKEN_KEY);

  // Telegram update fields
  const msg = update?.message ?? update?.edited_message ?? null;
  const callback = update?.callback_query ?? null;
  const chatId = msg?.chat?.id ?? callback?.message?.chat?.id ?? null;
  const text = String(msg?.text ?? callback?.data ?? "").trim();

  if (!chatId) return new Response("ok");

  // Load effective config (with inheritance)
  const baseProfile = await env.DB.prepare(
    "SELECT id,parent_profile_id,bot_logic_json FROM config_profiles WHERE id=?"
  ).bind(bot.config_profile_id).first<any>();

  const chain = await loadParents(env.DB, baseProfile?.parent_profile_id ?? null, 8);
  const mergedLogic = chain.reduce((acc, p) => mergeConfig(acc, safeJsonParse(p.bot_logic_json, {})), {});
  const logic = mergeConfig(mergedLogic, safeJsonParse(baseProfile?.bot_logic_json, {}));

  const routes = Array.isArray((logic as any).routes) ? (logic as any).routes : [];

  // default: /start
  if (text.startsWith("/start")) {
    await sendMessage(token, chatId, "已连接✅ 管理后台配置生效。");
    return new Response("ok");
  }

  // route match
  for (const r of routes) {
    if (!r || typeof r !== "object") continue;
    if (!matchRoute(r, text)) continue;

    const action = r.action ?? {};
    const type = String(action.type ?? "");

    try {
      if (type === "send_message") {
        await sendMessage(token, chatId, String(action.text ?? ""));
        return new Response("ok");
      }

      if (type === "call_connector") {
        const name = String(action.connectorName ?? "");
        const connector = await findConnector(env.DB, bot.config_profile_id, baseProfile?.parent_profile_id ?? null, name);

        if (!connector) {
          await sendMessage(token, chatId, `未找到 connector: ${name}`);
          return new Response("ok");
        }

        const input = buildInput(action.input ?? {}, { text, update });
        const data = await callConnector(env, connector, input);

        const tpl = String(action.outputTemplate ?? "OK");
        const out = renderTemplate(tpl, { data, text });
        await sendMessage(token, chatId, out);
        return new Response("ok");
      }

      if (type === "raw_telegram") {
        // advanced: call any telegram method with body (unsafe if misconfigured)
        const method = String(action.method ?? "");
        const body = buildInput(action.body ?? {}, { text, update, chatId });
        if (!method) throw new Error("missing telegram method");
        await tgCall(token, method, body);
        return new Response("ok");
      }
    } catch (e: any) {
      await sendMessage(token, chatId, `执行失败: ${String(e?.message ?? e)}`);
      return new Response("ok");
    }
  }

  return new Response("ok");
};

function matchRoute(route: any, text: string) {
  const type = String(route.type ?? "");
  const match = String(route.match ?? "");
  if (!match) return false;

  if (type === "command") {
    return text === match || text.startsWith(match + " ");
  }
  if (type === "keyword") {
    return text.includes(match);
  }
  if (type === "regex") {
    try {
      return new RegExp(match).test(text);
    } catch {
      return false;
    }
  }
  if (type === "callback") {
    return text === match || text.startsWith(match + ":");
  }
  return false;
}

async function loadParents(db: D1Database, parentId: string | null, limit: number) {
  const chain: any[] = [];
  let currentId = parentId;
  let i = 0;
  while (currentId && i < limit) {
    const p = await db.prepare("SELECT id,parent_profile_id,bot_logic_json FROM config_profiles WHERE id=?")
      .bind(currentId)
      .first<any>();
    if (!p) break;
    chain.unshift(p);
    currentId = p.parent_profile_id ?? null;
    i++;
  }
  return chain;
}


async function findConnector(db: D1Database, profileId: string, parentId: string | null, name: string) {
  // try current profile then walk parents
  let cur: string | null = profileId;
  let pid: string | null = parentId;
  // current
  const c0 = await db.prepare("SELECT * FROM external_connectors WHERE profile_id=? AND name=?")
    .bind(profileId, name)
    .first<any>();
  if (c0) return c0;

  let i = 0;
  while (pid && i < 8) {
    const c = await db.prepare("SELECT * FROM external_connectors WHERE profile_id=? AND name=?")
      .bind(pid, name)
      .first<any>();
    if (c) return c;

    const p = await db.prepare("SELECT parent_profile_id FROM config_profiles WHERE id=?")
      .bind(pid)
      .first<any>();
    pid = p?.parent_profile_id ?? null;
    i++;
  }
  return null;
}

function renderTemplate(tpl: string, ctx: any) {
  // Very small template:
  // - {{text}} => ctx.text
  // - {{data.xxx}} => deep path in ctx.data
  return tpl.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr) => {
    const val = getPath(ctx, String(expr).trim());
    return val === undefined || val === null ? "" : String(val);
  });
}

function getPath(obj: any, path: string) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function buildInput(spec: any, ctx: any) {
  // spec can include {{text}} placeholders too
  const s = JSON.stringify(spec);
  const replaced = s.replace(/\{\{\s*text\s*\}\}/g, String(ctx.text ?? ""));
  return JSON.parse(replaced);
}

import type { RequestHandler } from "./$types";
import { z } from "zod";
import { decryptTextAESGCM, encryptTextAESGCM, randomHex } from "$lib/server/crypto";
import { setWebhook, webhookUrl } from "$lib/server/telegram";

function requireRole(role: string, allow: string[]) {
  if (!allow.includes(role)) throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
}

export const GET: RequestHandler = async ({ platform, params }) => {
  const row = await platform!.env.DB.prepare(
    "SELECT id,name,username,config_profile_id,is_enabled,created_at,updated_at FROM bots WHERE id=?"
  ).bind(params.id).first<any>();
  if (!row) return json({ error: "NOT_FOUND" }, 404);
  return json(row);
};

const UpdateBody = z.object({
  name: z.string().min(1).optional(),
  username: z.string().optional(),
  token: z.string().min(20).optional(),
  configProfileId: z.string().min(1).optional(),
  isEnabled: z.boolean().optional(),
  rebindWebhook: z.boolean().optional()
});

export const PUT: RequestHandler = async ({ request, platform, url, params, locals }) => {
  requireRole(locals.admin?.role ?? "viewer", ["owner", "editor"]);
  const env = platform!.env;
  const botId = params.id;

  const body = UpdateBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return json({ error: "BAD_REQUEST" }, 400);

  const bot = await env.DB.prepare(
    "SELECT id,token_cipher,webhook_path_secret FROM bots WHERE id=?"
  ).bind(botId).first<any>();
  if (!bot) return json({ error: "NOT_FOUND" }, 404);

  let secret = bot.webhook_path_secret as string;
  let tokenCipher = bot.token_cipher as string;

  if (body.data.token) {
    tokenCipher = await encryptTextAESGCM(body.data.token, env.BOT_TOKEN_KEY);
  }

  // if requested, rotate webhook secret too
  if (body.data.rebindWebhook) {
    secret = randomHex(24);
  }

  const fields: string[] = [];
  const binds: any[] = [];
  const push = (k: string, v: any) => {
    fields.push(`${k}=?`);
    binds.push(v);
  };

  if (body.data.name !== undefined) push("name", body.data.name);
  if (body.data.username !== undefined) push("username", body.data.username ?? null);
  if (body.data.configProfileId !== undefined) push("config_profile_id", body.data.configProfileId);
  if (body.data.isEnabled !== undefined) push("is_enabled", body.data.isEnabled ? 1 : 0);

  // always update token/secret if changed
  if (body.data.token !== undefined) push("token_cipher", tokenCipher);
  if (body.data.rebindWebhook) push("webhook_path_secret", secret);

  push("updated_at", Date.now());

  if (fields.length) {
    await env.DB.prepare(`UPDATE bots SET ${fields.join(",")} WHERE id=?`)
      .bind(...binds, botId)
      .run();
  }

  if (body.data.token || body.data.rebindWebhook) {
    const token = await decryptTextAESGCM(tokenCipher, env.BOT_TOKEN_KEY);
    const wh = webhookUrl(url.origin, botId, secret);
    await setWebhook(token, wh, secret);
    return json({ ok: true, webhook: wh });
  }

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ platform, params, locals }) => {
  requireRole(locals.admin?.role ?? "viewer", ["owner"]);
  const env = platform!.env;

  await env.DB.prepare("DELETE FROM bots WHERE id=?").bind(params.id).run();
  return new Response(null, { status: 204 });
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

import type { RequestHandler } from "./$types";
import { z } from "zod";
import { encryptTextAESGCM, randomHex } from "$lib/server/crypto";
import { setWebhook, webhookUrl } from "$lib/server/telegram";

function requireRole(role: string, allow: string[]) {
  if (!allow.includes(role)) throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
}

export const GET: RequestHandler = async ({ platform }) => {
  const rows = await platform!.env.DB.prepare(
    "SELECT id,name,username,config_profile_id,is_enabled,created_at,updated_at FROM bots ORDER BY created_at DESC"
  ).all();
  return json(rows.results ?? []);
};

const CreateBody = z.object({
  name: z.string().min(1),
  token: z.string().min(20),
  username: z.string().optional(),
  configProfileId: z.string().min(1)
});

export const POST: RequestHandler = async ({ request, platform, url, locals }) => {
  requireRole(locals.admin?.role ?? "viewer", ["owner", "editor"]);
  const env = platform!.env;

  const body = CreateBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return json({ error: "MISSING_FIELDS" }, 400);

  const botId = crypto.randomUUID();
  const secret = randomHex(24);
  const now = Date.now();

  const tokenCipher = await encryptTextAESGCM(body.data.token, env.BOT_TOKEN_KEY);

  await env.DB.prepare(
    `INSERT INTO bots(id,name,username,token_cipher,webhook_path_secret,config_profile_id,is_enabled,created_at,updated_at)
     VALUES(?,?,?,?,?,?,1,?,?)`
  )
    .bind(
      botId,
      body.data.name,
      body.data.username ?? null,
      tokenCipher,
      secret,
      body.data.configProfileId,
      now,
      now
    )
    .run();

  const wh = webhookUrl(url.origin, botId, secret);
  await setWebhook(body.data.token, wh, secret);

  return json({ ok: true, botId, webhook: wh });
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

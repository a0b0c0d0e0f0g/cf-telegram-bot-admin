import type { RequestHandler } from "./$types";
import { z } from "zod";
import { decryptTextAESGCM } from "$lib/server/crypto";
import { getWebhookInfo } from "$lib/server/telegram";

const Q = z.object({ botId: z.string().min(1) });

export const GET: RequestHandler = async ({ platform, url }) => {
  const env = platform!.env;
  const q = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return json({ error: "BAD_REQUEST" }, 400);

  const bot = await env.DB.prepare("SELECT token_cipher FROM bots WHERE id=?")
    .bind(q.data.botId)
    .first<any>();
  if (!bot) return json({ error: "NOT_FOUND" }, 404);

  const token = await decryptTextAESGCM(bot.token_cipher, env.BOT_TOKEN_KEY);
  const info = await getWebhookInfo(token);
  return json(info);
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

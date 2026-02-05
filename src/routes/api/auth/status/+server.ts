import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ platform }) => {
  const env = platform!.env;
  const count = await env.DB.prepare("SELECT COUNT(1) as c FROM admins").first<any>();
  const hasAdmin = (count?.c ?? 0) > 0;
  return json({ hasAdmin });
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

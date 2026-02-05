import type { RequestHandler } from "./$types";
import { z } from "zod";

function requireRole(role: string, allow: string[]) {
  if (!allow.includes(role)) throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
}

export const GET: RequestHandler = async ({ platform, url }) => {
  const env = platform!.env;
  const profileId = url.searchParams.get("profileId") ?? "";
  if (!profileId) return json({ error: "profileId required" }, 400);

  const rows = await env.DB.prepare(
    "SELECT id,profile_id,name,endpoint,method,auth_type,auth_secret_name,timeout_ms,created_at,updated_at FROM external_connectors WHERE profile_id=? ORDER BY created_at DESC"
  ).bind(profileId).all();
  return json(rows.results ?? []);
};

const CreateBody = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1),
  endpoint: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headersJson: z.string().default("{}"),
  authType: z.string().default("none"),
  authSecretName: z.string().optional(),
  timeoutMs: z.number().int().positive().default(8000),
  retryJson: z.string().default("{\"retries\":0}"),
  responseMapJson: z.string().default("{}")
});

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  requireRole(locals.admin?.role ?? "viewer", ["owner", "editor"]);
  const env = platform!.env;

  const body = CreateBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return json({ error: "BAD_REQUEST" }, 400);

  const id = crypto.randomUUID();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO external_connectors(id,profile_id,name,endpoint,method,headers_json,auth_type,auth_secret_name,timeout_ms,retry_json,response_map_json,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      body.data.profileId,
      body.data.name,
      body.data.endpoint,
      body.data.method,
      body.data.headersJson,
      body.data.authType,
      body.data.authSecretName ?? null,
      body.data.timeoutMs,
      body.data.retryJson,
      body.data.responseMapJson,
      now,
      now
    )
    .run();

  return json({ ok: true, id });
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

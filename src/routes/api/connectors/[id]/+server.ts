import type { RequestHandler } from "./$types";
import { z } from "zod";

function requireRole(role: string, allow: string[]) {
  if (!allow.includes(role)) throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
}

export const GET: RequestHandler = async ({ platform, params }) => {
  const row = await platform!.env.DB.prepare("SELECT * FROM external_connectors WHERE id=?")
    .bind(params.id)
    .first<any>();
  if (!row) return json({ error: "NOT_FOUND" }, 404);
  return json(row);
};

const UpdateBody = z.object({
  name: z.string().min(1).optional(),
  endpoint: z.string().url().optional(),
  method: z.string().optional(),
  headersJson: z.string().optional(),
  authType: z.string().optional(),
  authSecretName: z.string().nullable().optional(),
  timeoutMs: z.number().int().positive().optional(),
  retryJson: z.string().optional(),
  responseMapJson: z.string().optional()
});

export const PUT: RequestHandler = async ({ request, platform, params, locals }) => {
  requireRole(locals.admin?.role ?? "viewer", ["owner", "editor"]);
  const env = platform!.env;

  const body = UpdateBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return json({ error: "BAD_REQUEST" }, 400);

  const fields: string[] = [];
  const binds: any[] = [];
  const push = (k: string, v: any) => { fields.push(`${k}=?`); binds.push(v); };

  if (body.data.name !== undefined) push("name", body.data.name);
  if (body.data.endpoint !== undefined) push("endpoint", body.data.endpoint);
  if (body.data.method !== undefined) push("method", body.data.method);
  if (body.data.headersJson !== undefined) push("headers_json", body.data.headersJson);
  if (body.data.authType !== undefined) push("auth_type", body.data.authType);
  if (body.data.authSecretName !== undefined) push("auth_secret_name", body.data.authSecretName);
  if (body.data.timeoutMs !== undefined) push("timeout_ms", body.data.timeoutMs);
  if (body.data.retryJson !== undefined) push("retry_json", body.data.retryJson);
  if (body.data.responseMapJson !== undefined) push("response_map_json", body.data.responseMapJson);

  push("updated_at", Date.now());

  await env.DB.prepare(`UPDATE external_connectors SET ${fields.join(",")} WHERE id=?`)
    .bind(...binds, params.id)
    .run();

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ platform, params, locals }) => {
  requireRole(locals.admin?.role ?? "viewer", ["owner", "editor"]);
  await platform!.env.DB.prepare("DELETE FROM external_connectors WHERE id=?")
    .bind(params.id)
    .run();
  return new Response(null, { status: 204 });
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

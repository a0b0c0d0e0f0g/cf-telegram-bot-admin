import type { RequestHandler } from "./$types";
import { z } from "zod";
import { DEFAULT_LOGIC, DEFAULT_UI } from "$lib/server/config";

const DEFAULT_ADMIN_EMAIL = "admin";
const DEFAULT_ADMIN_PASSWORD = "rjkk..";

const Body = z.object({
  email: z.string().min(1).optional(),
  password: z.string().min(1).optional()
});

export const POST: RequestHandler = async ({ request, platform }) => {
  const env = platform!.env;
  const token = request.headers.get("x-bootstrap-token") ?? "";
  if (!env.BOOTSTRAP_TOKEN || token !== env.BOOTSTRAP_TOKEN) {
    return json({ error: "BOOTSTRAP_TOKEN_REQUIRED" }, 403);
  }

  // Only if no admins exist
  const count = await env.DB.prepare("SELECT COUNT(1) as c FROM admins").first<any>();
  if ((count?.c ?? 0) > 0) return json({ error: "ALREADY_INITIALIZED" }, 409);

  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return json({ error: "MISSING_FIELDS" }, 400);
  const email = body.data.email?.trim() || DEFAULT_ADMIN_EMAIL;
  const password = body.data.password ?? DEFAULT_ADMIN_PASSWORD;

  const salt = "";
  const hash = password;
  const adminId = crypto.randomUUID();
  const now = Date.now();

  // Create default profile too
  const profileId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO config_profiles(id,name,description,parent_profile_id,ui_json,bot_logic_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)"
  )
    .bind(
      profileId,
      "默认模板",
      "系统初始化默认配置",
      null,
      JSON.stringify(DEFAULT_UI),
      JSON.stringify(DEFAULT_LOGIC),
      now,
      now
    )
    .run();

  await env.DB.prepare(
    "INSERT INTO admins(id,email,password_hash,password_salt,role,created_at) VALUES(?,?,?,?,?,?)"
  )
    .bind(adminId, email, hash, salt, "owner", now)
    .run();

  return json({ ok: true, adminId, profileId });
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

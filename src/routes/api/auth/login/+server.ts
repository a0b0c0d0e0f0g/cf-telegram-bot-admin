import type { RequestHandler } from "./$types";
import { z } from "zod";
import { signJWT } from "$lib/server/auth";
import { DEFAULT_LOGIC, DEFAULT_UI } from "$lib/server/config";

const DEFAULT_ADMIN_EMAIL = "admin";
const DEFAULT_ADMIN_PASSWORD = "rjkk..";

const Body = z.object({
  email: z.string().min(1),
  password: z.string().min(1)
});

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
  const env = platform!.env;
  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return json({ error: "MISSING_FIELDS" }, 400);

  const { email, password } = body.data;
  await ensureDefaultAdmin(env);

  const row = await env.DB
    .prepare("SELECT id,email,password_hash,password_salt,role FROM admins WHERE email=?")
    .bind(email.trim())
    .first<any>();

  if (!row) return json({ error: "ACCOUNT_NOT_FOUND" }, 401);

  if (password !== row.password_hash) return json({ error: "INVALID_CREDENTIALS" }, 401);

  const now = Math.floor(Date.now() / 1000);
  const token = await signJWT(
    {
      iss: env.JWT_ISSUER,
      aud: env.JWT_AUD,
      sub: row.id,
      email: row.email,
      role: row.role,
      iat: now,
      exp: now + 60 * 60 * 24 * 7
    },
    env.JWT_SECRET
  );

  cookies.set("session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return json({ ok: true });
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function ensureDefaultAdmin(env: App.Platform["env"]) {
  const count = await env.DB.prepare("SELECT COUNT(1) as c FROM admins").first<any>();
  if ((count?.c ?? 0) > 0) return;

  const salt = "";
  const hash = DEFAULT_ADMIN_PASSWORD;
  const adminId = crypto.randomUUID();
  const now = Date.now();

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
    .bind(adminId, DEFAULT_ADMIN_EMAIL, hash, salt, "owner", now)
    .run();
}

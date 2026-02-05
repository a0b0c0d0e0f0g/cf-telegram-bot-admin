import type { RequestHandler } from "./$types";
import { z } from "zod";
import { verifyPassword, signJWT } from "$lib/server/auth";

const Body = z.object({
  email: z.string().min(1),
  password: z.string().min(1)
});

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
  const env = platform!.env;
  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return json({ error: "MISSING_FIELDS" }, 400);

  const { email, password } = body.data;

  const row = await env.DB
    .prepare("SELECT id,email,password_hash,password_salt,role FROM admins WHERE email=?")
    .bind(email)
    .first<any>();

  if (!row) return json({ error: "INVALID_CREDENTIALS" }, 401);

  const ok = await verifyPassword(password, row.password_salt, row.password_hash);
  if (!ok) return json({ error: "INVALID_CREDENTIALS" }, 401);

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

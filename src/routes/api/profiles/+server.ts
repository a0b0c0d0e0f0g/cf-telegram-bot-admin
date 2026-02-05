import type { RequestHandler } from "./$types";
import { z } from "zod";
import { DEFAULT_LOGIC, DEFAULT_UI } from "$lib/server/config";

function requireRole(role: string, allow: string[]) {
  if (!allow.includes(role)) throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
}

export const GET: RequestHandler = async ({ platform }) => {
  const rows = await platform!.env.DB.prepare(
    "SELECT id,name,description,parent_profile_id,created_at,updated_at FROM config_profiles ORDER BY created_at DESC"
  ).all();
  return json(rows.results ?? []);
};

const CreateBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentProfileId: z.string().optional(),
  // optional: copy from another profile
  copyFromProfileId: z.string().optional()
});

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  requireRole(locals.admin?.role ?? "viewer", ["owner", "editor"]);
  const env = platform!.env;

  const body = CreateBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return json({ error: "BAD_REQUEST" }, 400);

  const id = crypto.randomUUID();
  const now = Date.now();

  let ui = DEFAULT_UI;
  let logic = DEFAULT_LOGIC;
  if (body.data.copyFromProfileId) {
    const src = await env.DB.prepare("SELECT ui_json,bot_logic_json FROM config_profiles WHERE id=?")
      .bind(body.data.copyFromProfileId)
      .first<any>();
    if (src) {
      ui = JSON.parse(String(src.ui_json));
      logic = JSON.parse(String(src.bot_logic_json));
    }
  }

  await env.DB.prepare(
    "INSERT INTO config_profiles(id,name,description,parent_profile_id,ui_json,bot_logic_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)"
  )
    .bind(
      id,
      body.data.name,
      body.data.description ?? null,
      body.data.parentProfileId ?? null,
      JSON.stringify(ui),
      JSON.stringify(logic),
      now,
      now
    )
    .run();

  return json({ ok: true, id });
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

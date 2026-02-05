import type { RequestHandler } from "./$types";
import { z } from "zod";
import { mergeConfig, safeJsonParse } from "$lib/server/config";

function requireRole(role: string, allow: string[]) {
  if (!allow.includes(role)) throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 });
}

export const GET: RequestHandler = async ({ platform, params, url }) => {
  const env = platform!.env;

  const profile = await env.DB.prepare(
    "SELECT id,name,description,parent_profile_id,ui_json,bot_logic_json,created_at,updated_at FROM config_profiles WHERE id=?"
  ).bind(params.id).first<any>();

  if (!profile) return json({ error: "NOT_FOUND" }, 404);

  const wantEffective = url.searchParams.get("effective") === "1";

  if (!wantEffective) return json(profile);

  const chain = await loadParents(env.DB, profile.parent_profile_id, 8);
  // Merge from oldest parent -> child
  const effectiveUI = chain.reduce((acc, p) => mergeConfig(acc, safeJsonParse(p.ui_json, {})), {});
  const effectiveLogic = chain.reduce((acc, p) => mergeConfig(acc, safeJsonParse(p.bot_logic_json, {})), {});
  return json({ ...profile, effective_ui: effectiveUI, effective_logic: effectiveLogic });
};

const UpdateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  parentProfileId: z.string().nullable().optional(),
  uiJson: z.string().optional(),
  botLogicJson: z.string().optional()
});

export const PUT: RequestHandler = async ({ request, platform, params, locals }) => {
  requireRole(locals.admin?.role ?? "viewer", ["owner", "editor"]);
  const env = platform!.env;

  const body = UpdateBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return json({ error: "BAD_REQUEST" }, 400);

  const fields: string[] = [];
  const binds: any[] = [];
  const push = (k: string, v: any) => {
    fields.push(`${k}=?`);
    binds.push(v);
  };

  if (body.data.name !== undefined) push("name", body.data.name);
  if (body.data.description !== undefined) push("description", body.data.description ?? null);
  if (body.data.parentProfileId !== undefined) push("parent_profile_id", body.data.parentProfileId);
  if (body.data.uiJson !== undefined) push("ui_json", body.data.uiJson);
  if (body.data.botLogicJson !== undefined) push("bot_logic_json", body.data.botLogicJson);

  push("updated_at", Date.now());

  await env.DB.prepare(`UPDATE config_profiles SET ${fields.join(",")} WHERE id=?`)
    .bind(...binds, params.id)
    .run();

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ platform, params, locals }) => {
  requireRole(locals.admin?.role ?? "viewer", ["owner"]);
  const env = platform!.env;
  await env.DB.prepare("DELETE FROM config_profiles WHERE id=?").bind(params.id).run();
  return new Response(null, { status: 204 });
};

async function loadParents(db: D1Database, parentId: string | null, limit: number) {
  const chain: any[] = [];
  let currentId = parentId;
  let i = 0;
  while (currentId && i < limit) {
    const p = await db.prepare("SELECT id,parent_profile_id,ui_json,bot_logic_json FROM config_profiles WHERE id=?")
      .bind(currentId)
      .first<any>();
    if (!p) break;
    chain.unshift(p); // ensure oldest first
    currentId = p.parent_profile_id ?? null;
    i++;
  }
  return chain;
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  return new Response(JSON.stringify({ admin: locals.admin ?? null }), {
    headers: { "content-type": "application/json" }
  });
};

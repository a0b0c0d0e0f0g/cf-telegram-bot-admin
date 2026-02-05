import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, url }) => {
  cookies.delete("session", { path: "/" });
  return new Response(null, { status: 204 });
};

export const GET: RequestHandler = async ({ cookies, url }) => {
  cookies.delete("session", { path: "/" });
  return Response.redirect(new URL("/login", url), 302);
};

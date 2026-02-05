import type { Handle } from "@sveltejs/kit";
import { verifyJWT } from "$lib/server/auth";

export const handle: Handle = async ({ event, resolve }) => {
  const url = new URL(event.request.url);
  const token = event.cookies.get("session");

  if (token && event.platform?.env?.JWT_SECRET) {
    const payload = await verifyJWT(token, event.platform.env.JWT_SECRET);
    if (payload && typeof payload === "object") {
      event.locals.admin = {
        id: String((payload as any).sub ?? ""),
        email: String((payload as any).email ?? ""),
        role: String((payload as any).role ?? "viewer")
      };
    }
  }

  // Require login for /dashboard and /api/* (except login/bootstrap)
  const isPublic =
    url.pathname === "/login" ||
    url.pathname.startsWith("/tg/") ||
    url.pathname === "/api/auth/login" ||
    url.pathname === "/api/bootstrap";

  const needsAuth = url.pathname.startsWith("/api/") || url.pathname.startsWith("/dashboard");
  if (needsAuth && !isPublic && !event.locals.admin?.id) {
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "content-type": "application/json" }
      });
    }
    return Response.redirect(new URL("/login", url), 302);
  }

  return resolve(event);
};

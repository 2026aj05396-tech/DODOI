// Auth.js endpoints: sign-in, OAuth callback, sign-out, session and CSRF token (API_SPECIFICATION §3).
// Auth.js applies its own CSRF protection here, so these are not wrapped in withRouteHandler.
import { handlers } from "@/server/auth";

export const { GET, POST } = handlers;

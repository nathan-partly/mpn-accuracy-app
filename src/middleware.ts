export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except auth routes, public assets, and API auth
  matcher: ["/((?!auth|_next/static|_next/image|favicon.ico|api/auth).*)"],
};

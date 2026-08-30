import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { ROUTE_ROLES } from "@/lib/rbac";
import {
  isRawTvTokenValid,
  KIOSK_COOKIE,
  KIOSK_MAX_AGE,
  signKioskSession,
} from "@/lib/kiosk-session";

// /galeri cek auth sendiri (token TV ATAU sesi login)
// /oauth & /.well-known: authorization server MCP, gate-nya password admin
// terpisah (bukan sesi NPK) — lihat src/actions/oauth.ts
const PUBLIC_PATHS = [
  "/login",
  "/tv",
  "/galeri",
  "/manifest.webmanifest",
  "/oauth",
  "/.well-known",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if ((pathname === "/galeri" || pathname === "/tv") && request.nextUrl.searchParams.has("token")) {
    if (!isRawTvTokenValid(request.nextUrl.searchParams.get("token"))) {
      const clean = request.nextUrl.clone();
      clean.searchParams.delete("token");
      return NextResponse.redirect(clean);
    }
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("token");
    const response = NextResponse.redirect(clean);
    response.cookies.set(KIOSK_COOKIE, await signKioskSession(), {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.INSECURE_COOKIES !== "1",
      sameSite: "strict",
      maxAge: KIOSK_MAX_AGE,
      path: "/",
    });
    return response;
  }

  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (!session) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("return", pathname);
    return NextResponse.redirect(url);
  }

  // Password default wajib diganti dulu — kunci semua halaman selain /profil
  if (session.mcp && pathname !== "/profil") {
    return NextResponse.redirect(new URL("/profil", request.url));
  }

  const rule = ROUTE_ROLES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  if (rule && !rule.roles.includes(session.role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Semua halaman kecuali aset statik & API (API cek sesi sendiri)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|logo).*)"],
};

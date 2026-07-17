import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { ROUTE_ROLES } from "@/lib/rbac";

const PUBLIC_PATHS = ["/login", "/tv", "/manifest.webmanifest"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

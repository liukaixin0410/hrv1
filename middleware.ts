import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = await verifySessionToken(token);
  const { pathname } = request.nextUrl;

  if (!valid && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (valid && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // 拦截所有页面与接口，放行 Next 静态资源与图标
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};

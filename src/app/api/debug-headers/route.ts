import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    host: request.headers.get("host"),
    xForwardedHost: request.headers.get("x-forwarded-host"),
    url: request.url,
    nextUrl: request.nextUrl.hostname,
  });
}

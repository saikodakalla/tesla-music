import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  clearSession();
  return NextResponse.redirect(new URL("/", req.nextUrl.origin).toString(), {
    status: 303,
  });
}

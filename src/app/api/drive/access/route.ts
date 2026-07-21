import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Access is now managed via OneDrive sharing" }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "Access is now managed via OneDrive sharing" }, { status: 410 });
}

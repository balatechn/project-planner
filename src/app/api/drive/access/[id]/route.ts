import { NextResponse } from "next/server";

export async function DELETE() {
  return NextResponse.json({ error: "Access is now managed via OneDrive sharing" }, { status: 410 });
}

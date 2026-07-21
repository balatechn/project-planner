import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getItemDownloadUrl } from "@/lib/drive-graph";

export async function GET(req: Request) {
  await requireUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const url = await getItemDownloadUrl(id);
  if (!url) return NextResponse.json({ error: "Download URL not available" }, { status: 404 });

  // ?mode=url → return JSON (used by preview embed)
  // default → 302 redirect (browser download)
  if (searchParams.get("mode") === "url") return NextResponse.json({ url });
  return NextResponse.redirect(url, 302);
}

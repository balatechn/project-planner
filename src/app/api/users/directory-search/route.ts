import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const GRAPH     = "https://graph.microsoft.com/v1.0";
const TENANT_ID = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "";
const CLIENT_ID = process.env.AUTH_MICROSOFT_ENTRA_ID_ID        ?? "";
const CLIENT_SECRET = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "";

async function getAppToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET || !TENANT_ID) return null;
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "client_credentials",
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          scope:         "https://graph.microsoft.com/.default",
        }),
      },
    );
    if (!res.ok) return null;
    const d = await res.json();
    return d.access_token ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  await requireUser();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  // ── Try Microsoft Graph directory search ──────────────────────────────
  const token = await getAppToken();
  if (token) {
    const url = new URL(`${GRAPH}/users`);
    url.searchParams.set("$search", `"displayName:${q}" OR "mail:${q}"`);
    url.searchParams.set("$select", "id,displayName,mail,jobTitle,department");
    url.searchParams.set("$top", "12");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization:    `Bearer ${token}`,
        ConsistencyLevel: "eventual",   // required for $search
      },
    });

    if (res.ok) {
      type GUser = { id: string; displayName: string; mail: string; jobTitle: string; department: string };
      const data = await res.json();
      const graphUsers: GUser[] = (data.value ?? []).filter((u: GUser) => u.mail);

      // Cross-ref against local DB so we know which users already have accounts
      const emails = graphUsers.map((u) => u.mail).filter(Boolean);
      const localMap = await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true },
      }).then((rows) => Object.fromEntries(rows.map((r) => [r.email, r.id])));

      return NextResponse.json({
        users: graphUsers.map((u) => ({
          azureId:    u.id,
          name:       u.displayName,
          email:      u.mail,
          jobTitle:   u.jobTitle ?? null,
          department: u.department ?? null,
          localId:    localMap[u.mail] ?? null,
        })),
      });
    }
  }

  // ── Fallback: local DB only ───────────────────────────────────────────
  const rows = await prisma.user.findMany({
    where: {
      OR: [
        { name:  { contains: q } },
        { email: { contains: q } },
      ],
    },
    select: { id: true, name: true, email: true, department: true },
    take: 12,
  });

  return NextResponse.json({
    users: rows.map((u) => ({
      azureId:    null,
      name:       u.name,
      email:      u.email,
      jobTitle:   null,
      department: u.department ?? null,
      localId:    u.id,
    })),
  });
}

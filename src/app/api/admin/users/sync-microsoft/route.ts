import { NextResponse } from "next/server";
import { requireUserWithPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/activity";

const GRAPH      = "https://graph.microsoft.com/v1.0";
const TENANT_ID  = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "";
const CLIENT_ID  = process.env.AUTH_MICROSOFT_ENTRA_ID_ID        ?? "";
const CLIENT_SECRET = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "";

async function getAppToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET || !TENANT_ID) return null;
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
}

type GraphUser = {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
};

async function fetchAllUsers(token: string): Promise<GraphUser[]> {
  const users: GraphUser[] = [];
  let url: string | null =
    `${GRAPH}/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department&$top=999`;

  while (url) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) break;
    const data: { value: GraphUser[]; "@odata.nextLink"?: string } = await r.json();
    users.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? null;
  }
  return users;
}

export async function POST() {
  const admin = await requireUserWithPermission("admin:users");

  const token = await getAppToken();
  if (!token) {
    return NextResponse.json(
      { error: "Microsoft Graph credentials not configured" },
      { status: 503 },
    );
  }

  const graphUsers = await fetchAllUsers(token);

  // Filter: must have a real email (not UPN-only service accounts)
  const eligible = graphUsers.filter(
    (u) => (u.mail ?? u.userPrincipalName)?.includes("@") &&
            !u.userPrincipalName.startsWith("#EXT#"),
  );

  // Fetch existing emails in one query
  const emails = eligible.map((u) => (u.mail ?? u.userPrincipalName).toLowerCase());
  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  const existingSet = new Set(existing.map((u) => u.email.toLowerCase()));

  const toCreate = eligible.filter(
    (u) => !existingSet.has((u.mail ?? u.userPrincipalName).toLowerCase()),
  );

  let created = 0;
  for (const u of toCreate) {
    const email = (u.mail ?? u.userPrincipalName).toLowerCase();
    try {
      await prisma.user.create({
        data: {
          email,
          name:       u.displayName,
          jobTitle:   u.jobTitle  ?? null,
          department: u.department ?? null,
          role:       "TEAM_MEMBER",
          isActive:   true,
        },
      });
      created++;
    } catch {
      // Skip duplicates (race condition) silently
    }
  }

  await writeAudit({
    userId:     admin.id,
    action:     "admin.sync_microsoft_users",
    entityType: "user",
    metadata:   { created, skipped: eligible.length - created, total: graphUsers.length },
  });

  return NextResponse.json({
    created,
    skipped:  eligible.length - created,
    total:    graphUsers.length,
  });
}

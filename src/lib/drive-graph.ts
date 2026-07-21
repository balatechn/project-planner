import { graphFetch } from "@/lib/graph";

const DRIVE_UPN = process.env.DRIVE_USER_UPN ?? "bala@nationalgroupindia.com";

function base() {
  return `/users/${encodeURIComponent(DRIVE_UPN)}/drive`;
}

// Encode a path for the Graph colon-path syntax: /root:/{path}:
// Each segment is encoded individually so slashes remain as separators.
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function rootEndpoint(path: string, suffix: string): string {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) return `${base()}/root${suffix}`;
  return `${base()}/root:/${encodePath(clean)}:${suffix}`;
}

const SELECT =
  "id,name,size,lastModifiedDateTime,lastModifiedBy,parentReference,folder,file,@microsoft.graph.downloadUrl";

export type DriveItem = {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  modifiedByName: string;
  isFolder: boolean;
  mimeType?: string;
  childCount?: number;
  downloadUrl?: string;
  parentPath?: string;
};

function mapItem(raw: Record<string, unknown>): DriveItem {
  const lmb = raw.lastModifiedBy as Record<string, unknown> | undefined;
  const lmbUser = lmb?.user as Record<string, unknown> | undefined;
  const folder = raw.folder as Record<string, unknown> | undefined;
  const file = raw.file as Record<string, unknown> | undefined;
  const parentRef = raw.parentReference as Record<string, unknown> | undefined;
  const rawPath = parentRef?.path as string | undefined;
  // Graph returns path like "/drive/root:/MEM-data/Pictures" — extract after "root:"
  const parentPath = rawPath?.split("root:")?.[1] ?? "/";

  return {
    id: raw.id as string,
    name: raw.name as string,
    size: (raw.size as number) ?? 0,
    lastModifiedDateTime: raw.lastModifiedDateTime as string,
    modifiedByName: (lmbUser?.displayName as string) ?? "",
    isFolder: !!folder,
    mimeType: file?.mimeType as string | undefined,
    childCount: folder?.childCount as number | undefined,
    downloadUrl: raw["@microsoft.graph.downloadUrl"] as string | undefined,
    parentPath,
  };
}

// ── Permission types & helpers ─────────────────────────────────────────────

export type Permission = {
  id: string;
  roles: string[];
  grantedToV2?: { user?: { email?: string; displayName?: string } };
  grantedToIdentitiesV2?: Array<{ user?: { email?: string } }>;
  link?: { type: string; scope: string };
  inheritedFrom?: { id: string };
};

export function userHasPermission(perms: Permission[], userEmail: string): boolean {
  const email = userEmail.toLowerCase();
  return perms.some((p) => {
    if (p.grantedToV2?.user?.email?.toLowerCase() === email) return true;
    if (p.grantedToIdentitiesV2?.some((i) => i.user?.email?.toLowerCase() === email)) return true;
    if (p.link?.scope === "organization") return true;
    return false;
  });
}

export function userCanWrite(perms: Permission[], userEmail: string): boolean {
  const email = userEmail.toLowerCase();
  return perms.some((p) => {
    if (!p.roles.some((r) => ["write", "owner"].includes(r))) return false;
    if (p.grantedToV2?.user?.email?.toLowerCase() === email) return true;
    if (p.grantedToIdentitiesV2?.some((i) => i.user?.email?.toLowerCase() === email)) return true;
    if (p.link?.scope === "organization") return true;
    return false;
  });
}

// Get permissions for a specific path (includes inherited)
export async function getPathPermissions(path: string): Promise<Permission[]> {
  const url = `${rootEndpoint(path, "/permissions")}`;
  const res = await graphFetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { value: Permission[] };
  return json.value ?? [];
}

// List folder children with permissions expanded (one API call)
export async function listFolderWithPerms(
  path: string,
): Promise<(DriveItem & { permissions: Permission[] })[]> {
  const url = `${rootEndpoint(path, "/children")}?$select=${SELECT}&$expand=permissions&$top=200`;
  const res = await graphFetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph listFolderWithPerms(${path}) failed ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { value: Record<string, unknown>[] };
  return (json.value ?? []).map((raw) => ({
    ...mapItem(raw),
    permissions: (raw.permissions as Permission[]) ?? [],
  }));
}

// ── Folder / file operations ───────────────────────────────────────────────

export async function listFolder(path: string): Promise<DriveItem[]> {
  const url = `${rootEndpoint(path, "/children")}?$select=${SELECT}&$top=200`;
  const res = await graphFetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph listFolder(${path}) failed ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { value: Record<string, unknown>[] };
  return (json.value ?? []).map(mapItem);
}

export async function searchDrive(query: string): Promise<DriveItem[]> {
  const url = `${base()}/root/search(q='${encodeURIComponent(query)}')?$select=${SELECT}&$top=50`;
  const res = await graphFetch(url);
  if (!res.ok) throw new Error(`Graph search failed: ${await res.text()}`);
  const json = (await res.json()) as { value: Record<string, unknown>[] };
  return (json.value ?? []).map(mapItem);
}

export async function createFolder(parentPath: string, name: string): Promise<DriveItem> {
  const url = rootEndpoint(parentPath, "/children");
  const res = await graphFetch(url, {
    method: "POST",
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
  });
  if (!res.ok) throw new Error(`Graph createFolder failed: ${await res.text()}`);
  return mapItem((await res.json()) as Record<string, unknown>);
}

export async function uploadFile(
  parentPath: string,
  fileName: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<DriveItem> {
  const filePath = parentPath === "/" || !parentPath ? `/${fileName}` : `${parentPath}/${fileName}`;
  const url = `${base()}/root:/${encodePath(filePath.replace(/^\//, ""))}:/content?@microsoft.graph.conflictBehavior=rename`;
  const res = await graphFetch(url, {
    method: "PUT",
    headers: { "Content-Type": mimeType || "application/octet-stream" },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`Graph upload failed: ${await res.text()}`);
  return mapItem((await res.json()) as Record<string, unknown>);
}

export async function getItemDownloadUrl(itemId: string): Promise<string | null> {
  const res = await graphFetch(`${base()}/items/${itemId}?$select=id,@microsoft.graph.downloadUrl`);
  if (!res.ok) return null;
  const item = (await res.json()) as Record<string, unknown>;
  return (item["@microsoft.graph.downloadUrl"] as string) ?? null;
}

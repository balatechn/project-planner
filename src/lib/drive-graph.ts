import { graphFetch } from "@/lib/graph";

const DRIVE_UPN = process.env.DRIVE_USER_UPN ?? "common.drive@nationalgroupindia.com";

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

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { graphFetch, isGraphConfigured } from "@/lib/graph";

// File storage abstraction. Driver = "graph" stores files in
// OneDrive/SharePoint via Microsoft Graph; "local" writes to
// /public/uploads for development.

export type StoredFile = {
  url: string;
  driver: "local" | "graph";
  driveItemId?: string;
};

function graphStorageEnabled(): boolean {
  return process.env.FILE_STORAGE_DRIVER === "graph" && isGraphConfigured();
}

export async function storeFile(
  fileName: string,
  bytes: Buffer | Uint8Array,
): Promise<StoredFile> {
  const safeName = fileName.replace(/[^\w.\-]+/g, "_");

  if (graphStorageEnabled()) {
    const driveId = process.env.GRAPH_DRIVE_ID;
    const base = driveId ? `/drives/${driveId}` : "/me/drive";
    // Simple upload (<4MB). Large files would use an upload session.
    const path = `${base}/root:/ProjectPlanner/${randomUUID()}-${safeName}:/content`;
    const res = await graphFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes as unknown as BodyInit,
    });
    if (!res.ok) {
      throw new Error(`Graph upload failed: ${await res.text()}`);
    }
    const item = (await res.json()) as { id: string; webUrl: string };
    return { url: item.webUrl, driver: "graph", driveItemId: item.id };
  }

  // Local driver
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const stored = `${randomUUID()}-${safeName}`;
  await writeFile(join(dir, stored), bytes);
  return { url: `/uploads/${stored}`, driver: "local" };
}

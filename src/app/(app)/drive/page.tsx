import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { DriveClient } from "./drive-client";

export const metadata: Metadata = { title: "Common Drive" };

export default async function DrivePage() {
  const user = await requireUser();
  return (
    <DriveClient
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  );
}

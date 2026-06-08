import type { Metadata } from "next";
import { requireUserWithPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { UsersTable } from "./users-table";

export const metadata: Metadata = { title: "Users & Roles" };

export default async function AdminUsersPage() {
  await requireUserWithPermission("admin:users");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      department: true,
      jobTitle: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage workspace members and their access levels."
      />
      <Card>
        <CardContent className="p-0">
          <UsersTable users={users} />
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { format } from "date-fns";
import { requireUserWithPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Audit Log" };

export default async function AuditPage() {
  await requireUserWithPermission("admin:audit");

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Security and compliance event trail (latest 200 events)."
      />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Entity</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {format(l.createdAt, "MMM d, HH:mm:ss")}
                    </td>
                    <td className="px-4 py-2.5">
                      {l.user?.name ?? l.user?.email ?? "System"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary">{l.action}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {l.entityType ? `${l.entityType}:${l.entityId ?? ""}` : "—"}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No audit events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

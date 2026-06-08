import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      _count: {
        select: { assignedTasks: true, ownedProjects: true, comments: true },
      },
    },
  });
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account details." />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <Avatar className="h-20 w-20">
              {user.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback className="text-2xl">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{user.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Department" value={user.department ?? "—"} />
            <Field label="Job title" value={user.jobTitle ?? "—"} />
            <Field
              label="Weekly capacity"
              value={`${user.weeklyCapacity} hours`}
            />
            <Field
              label="Assigned tasks"
              value={String(user._count.assignedTasks)}
            />
            <Field
              label="Owned projects"
              value={String(user._count.ownedProjects)}
            />
            <Field label="Comments" value={String(user._count.comments)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

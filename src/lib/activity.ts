import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Records a project/user activity timeline entry. Best-effort; never
// throws into the calling request path.
export async function logActivity(params: {
  userId: string;
  action: string;
  projectId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.activity
    .create({
      data: {
        userId: params.userId,
        action: params.action,
        projectId: params.projectId,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata,
      },
    })
    .catch((err) => console.error("logActivity failed", err));
}

export async function writeAudit(params: {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog
    .create({ data: { ...params } })
    .catch((err) => console.error("writeAudit failed", err));
}

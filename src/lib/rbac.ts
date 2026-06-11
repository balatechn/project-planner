import type { Role } from "@prisma/client";

// ------------------------------------------------------------------
// Role-based access control.
// Permissions are coarse-grained capabilities; helpers below map the
// four roles (Admin, Project Manager, Team Member, Viewer) to them.
// ------------------------------------------------------------------

export type Permission =
  | "project:create"
  | "project:edit"
  | "project:archive"
  | "project:delete"
  | "project:manageMembers"
  | "task:create"
  | "task:edit"
  | "task:delete"
  | "task:assign"
  | "task:updateStatus"
  | "comment:create"
  | "attachment:upload"
  | "report:view"
  | "report:export"
  | "admin:users"
  | "admin:audit"
  | "template:manage";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "project:create",
    "project:edit",
    "project:archive",
    "project:delete",
    "project:manageMembers",
    "task:create",
    "task:edit",
    "task:delete",
    "task:assign",
    "task:updateStatus",
    "comment:create",
    "attachment:upload",
    "report:view",
    "report:export",
    "admin:users",
    "admin:audit",
    "template:manage",
  ],
  PROJECT_MANAGER: [
    "project:create",
    "project:edit",
    "project:archive",
    "project:manageMembers",
    "task:create",
    "task:edit",
    "task:delete",
    "task:assign",
    "task:updateStatus",
    "comment:create",
    "attachment:upload",
    "report:view",
    "report:export",
    "template:manage",
  ],
  TEAM_MEMBER: [
    "project:create",
    "project:edit",
    "project:manageMembers",
    "task:create",
    "task:edit",
    "task:delete",
    "task:assign",
    "task:updateStatus",
    "comment:create",
    "attachment:upload",
    "report:view",
  ],
  VIEWER: ["report:view"],
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Throws a structured error usable in API routes when permission is missing. */
export class ForbiddenError extends Error {
  status = 403;
  constructor(permission?: Permission) {
    super(
      permission
        ? `Missing permission: ${permission}`
        : "You do not have permission to perform this action.",
    );
    this.name = "ForbiddenError";
  }
}

export function requirePermission(
  role: Role | undefined | null,
  permission: Permission,
): void {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}

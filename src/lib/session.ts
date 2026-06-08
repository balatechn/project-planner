import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Permission } from "@/lib/rbac";

/** Returns the current session or null. */
export async function getSession() {
  return auth();
}

/** Returns the current user, redirecting to /login if unauthenticated. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Require a specific permission for a server component / action. */
export async function requireUserWithPermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/unauthorized");
  return user;
}

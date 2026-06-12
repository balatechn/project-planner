import ExcelJS from "exceljs";
import { format } from "date-fns";
import { getAuthedUser, handle } from "@/lib/api";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/constants";

// GET /api/admin/users/export — download the user list as Excel (admin only).
export async function GET() {
  return handle(async () => {
    const user = await getAuthedUser();
    requirePermission(user.role, "admin:users");

    const users = await prisma.user.findMany({
      select: {
        name: true,
        email: true,
        entity: true,
        location: true,
        department: true,
        jobTitle: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Sharepoint";
    const ws = wb.addWorksheet("Users");
    ws.columns = [
      { header: "Name", key: "name", width: 28 },
      { header: "Email", key: "email", width: 32 },
      { header: "Entity", key: "entity", width: 24 },
      { header: "Location", key: "location", width: 16 },
      { header: "Department", key: "department", width: 18 },
      { header: "Job Title", key: "jobTitle", width: 22 },
      { header: "Role", key: "role", width: 16 },
      { header: "Active", key: "isActive", width: 8 },
      { header: "Last sign-in", key: "lastLoginAt", width: 18 },
      { header: "Joined", key: "createdAt", width: 14 },
    ];
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A5F" },
    };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    users.forEach((u) =>
      ws.addRow({
        name: u.name ?? "—",
        email: u.email,
        entity: u.entity ?? "",
        location: u.location ?? "",
        department: u.department ?? "",
        jobTitle: u.jobTitle ?? "",
        role: ROLE_LABELS[u.role],
        isActive: u.isActive ? "Yes" : "No",
        lastLoginAt: u.lastLoginAt ? format(u.lastLoginAt, "yyyy-MM-dd HH:mm") : "Never",
        createdAt: format(u.createdAt, "yyyy-MM-dd"),
      }),
    );

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="users-${format(new Date(), "yyyyMMdd")}.xlsx"`,
      },
    });
  });
}

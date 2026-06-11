import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { renderEmail, sendEmail } from "@/lib/email";

const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

export async function notify(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  email?: boolean;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, isActive: true },
  });

  // Diagnostic logging — visible in Vercel Function logs
  console.log(`[notify] userId=${params.userId} type=${params.type} wantEmail=${params.email} userFound=${!!user} isActive=${user?.isActive} hasEmail=${!!user?.email}`);

  if (!user || !user.isActive) {
    console.warn(`[notify] skipped — user not found or inactive. userId=${params.userId}`);
    return;
  }

  let emailSent = false;
  if (params.email && user.email) {
    console.log(`[notify] sending email to ${user.email} subject="${params.title}"`);
    emailSent = await sendEmail({
      to: user.email,
      subject: params.title,
      html: renderEmail({
        heading: params.title,
        body: params.body ?? "",
        ctaLabel: params.link ? "Open in Sharepoint" : undefined,
        ctaUrl: params.link ? `${baseUrl}${params.link}` : undefined,
      }),
    });
    console.log(`[notify] emailSent=${emailSent} to=${user.email}`);
  } else {
    console.log(`[notify] email skipped — wantEmail=${params.email} hasEmail=${!!user.email}`);
  }

  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
      emailSent,
    },
  });
}

/** Notify many users (e.g. all assignees) concurrently. */
export async function notifyMany(
  userIds: string[],
  payload: Omit<Parameters<typeof notify>[0], "userId">,
): Promise<void> {
  await Promise.all(
    Array.from(new Set(userIds)).map((userId) => notify({ userId, ...payload })),
  );
}

import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const enableDevLogin = process.env.ENABLE_DEV_LOGIN === "true";
const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
const allowedTenant = process.env.ALLOWED_TENANT_ID?.trim();

const entraConfigured =
  !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
  !!process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;

const providers: NextAuthConfig["providers"] = [];

if (entraConfigured) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      // Single-tenant issuer when a tenant id is provided, else "common".
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`
        : undefined,
      authorization: {
        params: { scope: "openid profile email User.Read offline_access" },
      },
    }),
  );
}

if (enableDevLogin) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Developer Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.isActive) return null;
        if (!verifyPassword(password, user.passwordHash)) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8h secure JWT sessions
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Credentials path already authorized above.
      if (account?.provider === "dev-login") return true;

      if (account?.provider === "microsoft-entra-id") {
        // Restrict to a single tenant if configured.
        const tid = (profile as { tid?: string } | undefined)?.tid;
        if (allowedTenant && tid && tid !== allowedTenant) return false;

        // Restrict to allowed email domains if configured.
        const email = (user.email ?? "").toLowerCase();
        if (allowedDomains.length > 0) {
          const domain = email.split("@")[1];
          if (!domain || !allowedDomains.includes(domain)) return false;
        }

        // Persist Entra object id + profile fields on first/each login.
        const oid = (profile as { oid?: string } | undefined)?.oid;
        if (email) {
          await prisma.user.updateMany({
            where: { email },
            data: {
              entraOid: oid ?? undefined,
              jobTitle:
                (profile as { jobTitle?: string } | undefined)?.jobTitle ??
                undefined,
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            },
          });
        }
        return true;
      }

      return true;
    },

    async jwt({ token, user }) {
      // On sign-in, `user` is present. Otherwise refresh role from DB
      // when missing so role changes propagate within the session window.
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, role: true, department: true },
        });
        if (dbUser) {
          // ── First-run bootstrap ─────────────────────────────────────────
          // If no ADMIN exists anywhere in the workspace, auto-promote this
          // user so the application is immediately usable after first login.
          if (dbUser.role !== "ADMIN") {
            const adminCount = await prisma.user.count({
              where: { role: "ADMIN" },
            });
            if (adminCount === 0) {
              await prisma.user.update({
                where: { id: dbUser.id },
                data: { role: "ADMIN" },
              });
              dbUser.role = "ADMIN";
            }
          }
          // ── End bootstrap ───────────────────────────────────────────────
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.department = dbUser.department ?? undefined;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.role = token.role as Role;
        session.user.department = token.department as string | undefined;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user?.id) return;
      await prisma.auditLog
        .create({
          data: { userId: user.id, action: "auth.login" },
        })
        .catch(() => undefined);
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export const authMeta = {
  entraConfigured,
  enableDevLogin,
};

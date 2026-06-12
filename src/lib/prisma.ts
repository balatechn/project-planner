import { PrismaClient, Prisma } from "@prisma/client";
export { Prisma };

// ------------------------------------------------------------------
// Soft delete: Project and Task rows with deletedAt set live in the
// recycle bin. The client extension below transparently filters them
// out of every read query unless the caller explicitly passes a
// deletedAt condition (which the recycle-bin pages do).
// ------------------------------------------------------------------

const SOFT_DELETE_MODELS = new Set(["Project", "Task"]);
const FILTERED_READS = new Set([
  "findMany",
  "findFirst",
  "count",
  "aggregate",
  "groupBy",
]);

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && SOFT_DELETE_MODELS.has(model)) {
            if (FILTERED_READS.has(operation)) {
              const a = args as { where?: Record<string, unknown> };
              // Respect explicit deletedAt conditions (recycle bin queries)
              if (a.where?.deletedAt === undefined) {
                a.where = { ...a.where, deletedAt: null };
              }
            } else if (operation === "findUnique") {
              // findUnique can't take non-unique filters — post-check instead
              const result = await query(args);
              if (
                result &&
                (result as { deletedAt?: Date | null }).deletedAt
              ) {
                return null;
              }
              return result;
            }
          }
          return query(args);
        },
      },
    },
  });
}

// Prevent multiple instances of Prisma Client in development (HMR).
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

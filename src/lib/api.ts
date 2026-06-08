import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { ForbiddenError } from "@/lib/rbac";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Resolve the authenticated user for a route handler or throw 401. */
export async function getAuthedUser() {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Authentication required");
  return session.user;
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Wrap a route handler so thrown errors become clean JSON responses. */
export function handle(
  fn: () => Promise<Response>,
): Promise<Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.flatten() },
        { status: 422 },
      );
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Unhandled API error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  });
}

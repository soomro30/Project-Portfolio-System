import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof RequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    const issue = error instanceof ZodError ? error.issues[0] : undefined;
    const field = issue?.path.join(".");
    return NextResponse.json(
      { error: field ? `Invalid request field: ${field}.` : "Invalid request body." },
      { status: 400 },
    );
  }

  console.error("API request failed:", error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json({ error: "The request could not be completed." }, { status: 500 });
}

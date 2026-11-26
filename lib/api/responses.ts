import { NextResponse } from "next/server";

export function apiError(
  code: string,
  message: string,
  status: number,
  fieldErrors?: Record<string, string>,
) {
  return NextResponse.json(
    {
      error: {
        code,
        ...(fieldErrors ? { fieldErrors } : {}),
        message,
      },
    },
    { status },
  );
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

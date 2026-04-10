import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();
  const correct = process.env.APP_PASSWORD || "scandiweb2026";

  if (password === correct) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function checkPassword(password: string): boolean {
  const correct = process.env.APP_PASSWORD || "scandiweb2026";
  return password === correct;
}

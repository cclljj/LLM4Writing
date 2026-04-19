import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getUserStore } from "@/src/lib/user-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const profile = await getUserStore(user.username);
  return NextResponse.json({
    authenticated: true,
    user: {
      ...user,
      name: profile?.name ?? "",
      school: profile?.school ?? ""
    }
  });
}

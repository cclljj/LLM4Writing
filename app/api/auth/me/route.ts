import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth-server";
import { getUserStore } from "@/src/lib/user-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { authenticated: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache"
        }
      }
    );
  }

  const profile = await getUserStore(user.username);
  if (!profile || (profile.role && profile.role !== user.role)) {
    return NextResponse.json(
      { authenticated: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache"
        }
      }
    );
  }
  return NextResponse.json(
    {
      authenticated: true,
      user: {
        ...user,
        name: profile?.name ?? "",
        school: profile?.school ?? ""
      }
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache"
      }
    }
  );
}

import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-server";
import { getAdminData } from "@/lib/admin-grants";

export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  return NextResponse.json(await getAdminData());
}

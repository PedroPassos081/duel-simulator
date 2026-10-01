import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { closeReport, countOpenReports, listReports, ReportError, type ReportStatus } from "@/lib/reports";

// Aba Denúncias do Admin
export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const param = new URL(req.url).searchParams.get("status");
  const status: ReportStatus = param === "resolved" || param === "dismissed" ? param : "open";
  const [reports, open] = await Promise.all([listReports(status), countOpenReports()]);
  return NextResponse.json({ reports, open });
}

const closeSchema = z.object({ id: z.string().min(1), status: z.enum(["resolved", "dismissed"]), note: z.string().max(500).optional() });

// POST: resolve ou arquiva uma denúncia
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = closeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    await closeReport(admin.id, parsed.data.id, parsed.data.status, parsed.data.note);
    return NextResponse.json({ message: parsed.data.status === "resolved" ? "Denúncia resolvida." : "Denúncia arquivada." });
  } catch (err) {
    if (err instanceof ReportError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}

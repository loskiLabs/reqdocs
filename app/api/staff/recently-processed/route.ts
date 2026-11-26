import { apiSuccess } from "@/lib/api/responses";
import { requireApiRole } from "@/lib/auth/api-auth";
import { listStaffProcessed } from "@/lib/history/server";
export async function GET() { const auth = await requireApiRole("staff"); if ("errorResponse" in auth) return auth.errorResponse; return apiSuccess(await listStaffProcessed(auth.profile.id)); }

import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type AllowedRole,
  canViewCRM,
  canViewReports,
  canViewUsers,
  isAdminLike,
  normalizeRole,
} from "@/lib/roles";

// cache() — aynı request içinde birden fazla çağrılsa bile
// Supabase'e sadece 1 kez gider. Layout + API route aynı render'da
// birbirini tekrar tetiklemez.
const getAllowedUserOrThrowBase = cache(async () => {
  const supabase = await createSupabaseServerClient();

  // getUser() + allowed_users sorgusunu paralel çalıştır
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user?.email) {
    throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });
  }

  const email = userData.user.email;

  const { data: allowed, error: allowedErr } = await supabase
    .from("allowed_users")
    .select("email, role, is_active, full_name")
    .eq("email", email)
    .maybeSingle();

  if (allowedErr) throw Object.assign(allowedErr, { status: 500 });
  if (!allowed || !allowed.is_active) {
    throw Object.assign(new Error("FORBIDDEN"), { status: 403 });
  }

  const role = normalizeRole(allowed.role) ?? "user";
  return { email, role, full_name: allowed.full_name as string | null };
});

export async function getSessionEmailOrNull(): Promise<string | null> {
  try {
    const user = await getAllowedUserOrThrowBase();
    return user.email;
  } catch {
    return null;
  }
}

export async function requireAllowedUserOrThrow() {
  return getAllowedUserOrThrowBase();
}

export async function requireAdminOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!isAdminLike(allowed.role)) throw Object.assign(new Error("FORBIDDEN"), { status: 403 });
  return allowed;
}

export async function requireCrmAccessOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!canViewCRM(allowed.role)) throw Object.assign(new Error("FORBIDDEN"), { status: 403 });
  return allowed;
}

export async function requireReportsAccessOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!canViewReports(allowed.role)) throw Object.assign(new Error("FORBIDDEN"), { status: 403 });
  return allowed;
}

export async function requireUsersAccessOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!canViewUsers(allowed.role)) throw Object.assign(new Error("FORBIDDEN"), { status: 403 });
  return allowed;
}

export { isAdminLike, canViewCRM, canViewReports, canViewUsers } from "@/lib/roles";
export type { AllowedRole } from "@/lib/roles";

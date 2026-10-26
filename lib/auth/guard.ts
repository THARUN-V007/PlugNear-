import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/validation/auth";

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  phone: string | null;
  created_at: string;
}

/**
 * Ensures the user is authenticated and retrieves their profile.
 * If not authenticated, redirects to /login.
 */
export async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    // Session exists but profile not found; redirect to login
    redirect("/login");
  }

  return { user, profile: profile as UserProfile };
}

/**
 * Enforces role-based page protection.
 * If the user's role does not match expectedRole, redirects them to their correct home.
 */
export async function requireRole(expectedRole: UserRole) {
  const { user, profile } = await requireUser();

  if (profile.role !== expectedRole) {
    // If a driver attempts to open host page, redirect to driver home
    if (profile.role === "driver") {
      redirect("/driver?forbidden=true");
    }
    // If a host attempts to open driver page, redirect to host home
    if (profile.role === "host") {
      redirect("/host?forbidden=true");
    }
    redirect("/login");
  }

  return { user, profile };
}

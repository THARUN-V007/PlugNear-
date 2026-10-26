"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SignUpSchema, LogInSchema, type UserRole } from "@/lib/validation/auth";

export interface AuthActionState {
  error?: string;
  success?: string;
}

export async function signUpAction(
  _prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    phone: formData.get("phone") || "",
  };

  const parsed = SignUpSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      error: parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { name, email, password, role, phone } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        phone: phone || null,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is enabled on Supabase, the session might be null initially.
  // In development/test environments or when email confirmation is disabled, user is logged in directly.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(role === "host" ? "/host" : "/driver");
  }

  return {
    success:
      "Account registered successfully! If email confirmation is enabled in your Supabase project, please check your inbox, or log in with your credentials.",
  };
}

export async function logInAction(
  _prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = LogInSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      error: parsed.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    return { error: authError?.message || "Invalid credentials." };
  }

  // Fetch role from profiles table to navigate properly
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  const role = (profile?.role as UserRole) || "driver";

  revalidatePath("/", "layout");
  redirect(role === "host" ? "/host" : "/driver");
}

export async function logOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

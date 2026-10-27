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
    const errorLower = error.message.toLowerCase();
    if (errorLower.includes("rate limit") || errorLower.includes("too many requests")) {
      return {
        error:
          "Too many sign-up attempts. Please wait a few minutes and try again, or log in if you already have an account.",
      };
    }
    return { error: error.message };
  }

  // When email confirmation is disabled, session or user is returned immediately
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(role === "host" ? "/host" : "/driver");
  }

  if (data.user) {
    // If confirmation is disabled, attempt immediate sign-in so user lands directly on role page
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!signInError) {
      revalidatePath("/", "layout");
      redirect(role === "host" ? "/host" : "/driver");
    }
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

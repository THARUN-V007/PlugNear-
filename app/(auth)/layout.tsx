import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Signed-in users should never see the sign-in or sign-up forms.
 * Redirecting here (instead of inside each page) keeps both auth pages honest
 * about where a session belongs, without creating a login loop when the users
 * are already authenticated.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // Only bounce them away once we know which portal is theirs; a session with
    // no profile row still needs the forms available to recover.
    if (profile?.role === "host" || profile?.role === "driver") {
      redirect(profile.role === "host" ? "/host" : "/driver");
    }
  }

  return children;
}

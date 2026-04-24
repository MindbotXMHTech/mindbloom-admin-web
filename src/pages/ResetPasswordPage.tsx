import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { LoadingScreen } from "../components/ui/loading";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!session) {
      setError("Open the password reset link from your email first.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await supabase.auth.signOut();
    setSaving(false);
    setNotice("Password updated. Please sign in again.");
    setTimeout(() => {
      navigate("/login", { replace: true });
    }, 800);
  };

  if (loading) {
    return (
      <LoadingScreen
        eyebrow="Loading"
        title="Checking reset link"
        description="Confirming that your reset session is ready before you set a new password."
      />
    );
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="w-full max-w-[560px] rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.92)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
          Password reset
        </div>
        <h1 className="mt-2 text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
          Set a new password
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
          Choose a new password for your admin account. You will be signed out after saving.
        </p>

        {error ? (
          <p className="mt-4 rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135]">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="mt-4 rounded-2xl border border-[#b9d7b1] bg-[rgba(237,247,233,0.98)] px-4 py-3 text-sm text-[#35613a]">
            {notice}
          </p>
        ) : null}

        {!session ? (
          <div className="mt-6 grid gap-3 rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
            <p className="text-sm leading-6 text-[#7b6d5f]">
              No reset session was found. Open the link from your email again or ask the admin
              team to send another reset link.
            </p>
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-1.5 text-sm text-[#7b6d5f]">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
              />
            </label>

            <label className="grid gap-1.5 text-sm text-[#7b6d5f]">
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
                disabled={saving}
              >
                {saving ? "Saving..." : "Update password"}
              </button>
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
              >
                Back to login
              </Link>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

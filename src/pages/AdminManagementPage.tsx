import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, RefreshCw, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { supabase, supabaseAnonKey, supabaseUrl } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { formatDate } from "./blog/blogShared";

type AdminUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const PASSWORD_FLASH_KEY = "mindbloom-admin-password-flash";
const PASSWORD_FLASH_EVENT = "mindbloom-admin-flash";

export default function AdminManagementPage() {
  const { session, user, signOut } = useAuth();
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [removingUserId, setRemovingUserId] = useState("");
  const [pendingRemoveRow, setPendingRemoveRow] = useState<AdminUserRow | null>(null);

  const isSelf = (row: AdminUserRow) => row.user_id === user?.id;

  const loadAdmins = async () => {
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("admin_users")
      .select("user_id,email,display_name,role,is_active,created_at,updated_at")
      .order("created_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setAdmins([]);
      setLoading(false);
      return;
    }

    setAdmins((data ?? []) as AdminUserRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadAdmins();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => {
      setNotice("");
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const storedFlash = window.sessionStorage.getItem(PASSWORD_FLASH_KEY);
    if (!storedFlash) return;

    try {
      const parsed = JSON.parse(storedFlash) as {
        type: "success" | "error";
        message: string;
      };
      if (parsed.message) {
        setPasswordStatus(parsed);
      }
    } catch {
      // ignore malformed flash data
    } finally {
      window.sessionStorage.removeItem(PASSWORD_FLASH_KEY);
    }
  }, []);

  useEffect(() => {
    if (!passwordStatus) return undefined;

    const timeout = window.setTimeout(() => {
      setPasswordStatus(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [passwordStatus]);

  const currentAdmin = useMemo(
    () => admins.find((row) => row.user_id === user?.id) ?? null,
    [admins, user?.id],
  );

  const sendPasswordFlash = (flash: { type: "success" | "error"; message: string }) => {
    window.sessionStorage.setItem(PASSWORD_FLASH_KEY, JSON.stringify(flash));
    window.dispatchEvent(new CustomEvent(PASSWORD_FLASH_EVENT, { detail: flash }));
  };

  const invokeAdminAction = async (body: unknown) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    if (!session?.access_token) {
      throw new Error("Missing signed-in session.");
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/admin-actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let payload: { error?: string; ok?: boolean } | null = null;

    if (text) {
      try {
        payload = JSON.parse(text) as { error?: string; ok?: boolean };
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      throw new Error(payload?.error ?? text ?? `Request failed (${response.status})`);
    }

    return payload ?? {};
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setPasswordStatus(null);

    if (!newPassword || newPassword.length < 8) {
      setError("Use at least 8 characters for the new password.");
      setPasswordStatus({
        type: "error",
        message: "Use at least 8 characters for the new password.",
      });
      sendPasswordFlash({
        type: "error",
        message: "Use at least 8 characters for the new password.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      setPasswordStatus({
        type: "error",
        message: "New password and confirmation do not match.",
      });
      sendPasswordFlash({
        type: "error",
        message: "New password and confirmation do not match.",
      });
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setPasswordStatus({
        type: "error",
        message: updateError.message,
      });
      sendPasswordFlash({
        type: "error",
        message: updateError.message,
      });
      setBusy(false);
      return;
    }

    try {
      await invokeAdminAction({ action: "complete_setup" });
    } catch {
      // Keep the password change successful even if the reminder flag fails to clear.
    }

    setNewPassword("");
    setConfirmPassword("");
    setBusy(false);
    setPasswordStatus({
      type: "success",
      message: "Password updated successfully.",
    });
    sendPasswordFlash({
      type: "success",
      message: "Password updated successfully.",
    });
    setNotice("Password updated successfully.");
  };

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const data = await invokeAdminAction({
        action: "invite",
        email: inviteEmail,
        displayName: inviteName,
        role: inviteRole,
      });

      if ((data as { error?: string }).error) {
        setError((data as { error?: string }).error ?? "Invite failed.");
        return;
      }

      setInviteEmail("");
      setInviteName("");
      setInviteRole("admin");
      await loadAdmins();
      setNotice("Invite sent. The new admin can open the email and finish setup from the overview.");
    } catch (invokeError) {
      setError(invokeError instanceof Error ? invokeError.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (row: AdminUserRow) => {
    setError("");
    setNotice("");
    setRemovingUserId(row.user_id);

    try {
      const data = await invokeAdminAction({ action: "remove", userId: row.user_id });

      if ((data as { error?: string }).error) {
        setError((data as { error?: string }).error ?? "Remove failed.");
        return;
      }

      await loadAdmins();
      setNotice("Admin removed successfully.");
    } catch (invokeError) {
      setError(invokeError instanceof Error ? invokeError.message : "Remove failed.");
    } finally {
      setRemovingUserId("");
      setPendingRemoveRow(null);
    }
  };

  return (
    <section className="grid gap-4">
      <section className="rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Admin management
            </div>
            <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
              Team access
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
              Change your password, invite new admins, and remove accounts that no longer need
              access.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
              onClick={loadAdmins}
            >
              <RefreshCw size={16} strokeWidth={2} />
              Refresh
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#a941352e] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[rgba(169,65,53,0.08)]"
              onClick={signOut}
            >
              <UserRound size={16} strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-2xl border border-[#b9d7b1] bg-[rgba(237,247,233,0.98)] px-4 py-3 text-sm text-[#35613a] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          {notice}
        </p>
      ) : null}

      {passwordStatus ? (
        <div
          className={[
            "fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl border px-4 py-3 shadow-[0_20px_50px_rgba(65,43,27,0.18)] backdrop-blur-md",
            passwordStatus.type === "success"
              ? "border-[#b9d7b1] bg-[rgba(237,247,233,0.98)] text-[#35613a]"
              : "border-[#e3b6af] bg-[rgba(255,238,235,0.98)] text-[#8e3a32]",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <strong className="text-sm font-semibold">
                {passwordStatus.type === "success" ? "Saved" : "Save failed"}
              </strong>
              <span className="text-sm leading-6">{passwordStatus.message}</span>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/5"
              aria-label="Close notification"
              onClick={() => setPasswordStatus(null)}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
        <article className="grid gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div>
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              My account
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              Password controls
            </h2>
          </div>

          <div className="grid gap-3 rounded-2xl border border-[#e3d4c6] bg-white/80 p-4 text-sm text-[#7b6d5f]">
            <div>
              <div className="text-xs font-medium tracking-[0.18em] uppercase">Signed in as</div>
              <div className="mt-1 text-[#2f2a24]">{session?.user.email ?? "Unknown"}</div>
            </div>
            <div>
              <div className="text-xs font-medium tracking-[0.18em] uppercase">Admin record</div>
              <div className="mt-1 text-[#2f2a24]">
                {currentAdmin?.display_name || currentAdmin?.email || currentAdmin?.user_id || "-"}
              </div>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={handlePasswordChange}>
            <label className="grid gap-1.5 text-sm text-[#7b6d5f]">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter a new password"
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
              />
            </label>

            <label className="grid gap-1.5 text-sm text-[#7b6d5f]">
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Type it again"
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
                disabled={busy}
              >
                <ShieldAlert size={16} strokeWidth={2} />
                {busy ? "Saving..." : "Update password"}
              </button>
            </div>
            {passwordStatus ? (
              <p
                className={[
                  "rounded-2xl px-4 py-3 text-sm shadow-[0_14px_36px_rgba(65,43,27,0.06)]",
                  passwordStatus.type === "success"
                    ? "border border-[#b9d7b1] bg-[rgba(237,247,233,0.98)] text-[#35613a]"
                    : "border border-[#e3b6af] bg-[rgba(255,238,235,0.98)] text-[#8e3a32]",
                ].join(" ")}
              >
                {passwordStatus.message}
              </p>
            ) : null}
          </form>
        </article>

        <article className="grid gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div>
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Invite admin
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              New access
            </h2>
          </div>

          <form className="grid gap-4" onSubmit={handleInvite}>
            <label className="grid gap-1.5 text-sm text-[#7b6d5f]">
              <span>Email</span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="new.admin@example.com"
                required
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
              />
            </label>

            <label className="grid gap-1.5 text-sm text-[#7b6d5f]">
              <span>Display name</span>
              <input
                type="text"
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
                placeholder="Optional display name"
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
              />
            </label>

            <label className="grid gap-1.5 text-sm text-[#7b6d5f]">
              <span>Role</span>
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
              </select>
            </label>

            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
              disabled={busy}
            >
              <Plus size={16} strokeWidth={2} />
              {busy ? "Inviting..." : "Invite new admin"}
            </button>
            <p className="text-sm leading-6 text-[#7b6d5f]">
              The invited admin will receive an email link, land on the overview page, and see
              the password setup reminder.
            </p>
          </form>
        </article>
      </section>

      <section className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Admin team
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              {admins.length} members
            </h2>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-[#7b6d5f]">Loading admin list...</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {admins.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
                <p className="text-sm leading-6 text-[#7b6d5f]">No admin members found.</p>
              </div>
            ) : (
              admins.map((row) => (
                <article
                  key={row.user_id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e3d4c6] bg-white/80 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[15px] font-semibold text-[#2f2a24]">
                        {row.display_name || row.email || row.user_id}
                      </strong>
                      <span className="badge neutral">{row.role}</span>
                      <span className={row.is_active ? "badge success" : "badge neutral"}>
                        {row.is_active ? "Active" : "Disabled"}
                      </span>
                      {isSelf(row) ? <span className="badge warning">You</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#7b6d5f]">
                      <span>{row.email || "No email stored"}</span>
                      <span>Updated {formatDate(row.updated_at)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-[#a941352e] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[rgba(169,65,53,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setPendingRemoveRow(row)}
                    disabled={busy || removingUserId === row.user_id || isSelf(row)}
                    title={isSelf(row) ? "You cannot remove yourself" : "Remove admin"}
                  >
                    <Trash2 size={16} strokeWidth={2} />
                    {removingUserId === row.user_id ? "Removing..." : "Remove"}
                  </button>
                </article>
              ))
            )}
          </div>
        )}
      </section>

      {pendingRemoveRow ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(47,42,36,0.34)] px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.98)] p-5 shadow-[0_24px_70px_rgba(65,43,27,0.18)]">
            <div className="grid gap-2">
              <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                Confirm remove
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-[#2f2a24]">
                Remove this admin?
              </h3>
              <p className="text-sm leading-6 text-[#7b6d5f]">
                {pendingRemoveRow.display_name || pendingRemoveRow.email || pendingRemoveRow.user_id}
                {" "}will lose access to the admin web.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                onClick={() => setPendingRemoveRow(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#a941352e] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[rgba(169,65,53,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  const row = pendingRemoveRow;
                  if (!row) return;
                  void handleRemove(row);
                }}
                disabled={busy || removingUserId === pendingRemoveRow.user_id || isSelf(pendingRemoveRow)}
              >
                <Trash2 size={16} strokeWidth={2} />
                {removingUserId === pendingRemoveRow.user_id ? "Removing..." : "Remove admin"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

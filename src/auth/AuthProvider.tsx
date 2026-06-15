import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthContextValue = {
  loading: boolean;
  accessError: string;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  needsPasswordSetup: boolean;
  signOut: () => Promise<void>;
  refreshAccess: (options?: { showLoading?: boolean }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const clearRejectedSession = async () => {
      setSession(null);
      setIsAdmin(false);
      setNeedsPasswordSetup(false);

      try {
        await supabase.auth.signOut();
      } catch {
        // The local guard is already cleared; ignore remote sign-out failures.
      }
    };

    const syncSession = async (
      nextSession: Session | null,
      options: { showLoading?: boolean } = {},
    ) => {
      if (!isMounted) return;

      if (options.showLoading) {
        setLoading(true);
      }

      setAccessError("");
      setSession(nextSession);

      if (!nextSession) {
        setIsAdmin(false);
        setNeedsPasswordSetup(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("admin_users")
        .select("role,is_active,email,needs_password_setup")
        .eq("user_id", nextSession.user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        setAccessError(error.message);
        await clearRejectedSession();
        setLoading(false);
        return;
      }

      if (!data) {
        setAccessError("You do not have admin access.");
        await clearRejectedSession();
        setLoading(false);
        return;
      }

      if (!data.is_active) {
        setAccessError("Your admin access has been disabled.");
        await clearRejectedSession();
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      setNeedsPasswordSetup(Boolean(data.needs_password_setup));
      setLoading(false);
    };

    const refreshAccess = async (options: { showLoading?: boolean } = {}) => {
      const { data } = await supabase.auth.getSession();
      await syncSession(data.session, options);
    };

    void refreshAccess({ showLoading: true });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void syncSession(nextSession);
      },
    );

    const handleFocus = () => {
      void refreshAccess();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshAccess();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const accessCheckInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshAccess();
      }
    }, 30000);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(accessCheckInterval);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshAccess = useCallback(async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading) {
      setLoading(true);
    }

    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      setSession(null);
      setIsAdmin(false);
      setNeedsPasswordSetup(false);
      setLoading(false);
      return;
    }

    const { data: adminData, error } = await supabase
      .from("admin_users")
      .select("is_active,needs_password_setup")
      .eq("user_id", data.session.user.id)
      .maybeSingle();

    if (error) {
      setAccessError(error.message);
      setSession(null);
      setIsAdmin(false);
      setNeedsPasswordSetup(false);
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (!adminData || !adminData.is_active) {
      setAccessError(
        adminData ? "Your admin access has been disabled." : "You do not have admin access.",
      );
      setSession(null);
      setIsAdmin(false);
      setNeedsPasswordSetup(false);
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    setAccessError("");
    setSession(data.session);
    setIsAdmin(true);
    setNeedsPasswordSetup(Boolean(adminData.needs_password_setup));
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      accessError,
      session,
      user: session?.user ?? null,
      isAdmin,
      needsPasswordSetup,
      signOut,
      refreshAccess,
    }),
    [accessError, isAdmin, loading, needsPasswordSetup, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

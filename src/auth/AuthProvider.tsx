import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const mountedRef = useRef(true);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshAccess = useCallback(async (options: { showLoading?: boolean } = {}) => {
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

    if (options.showLoading) {
      setLoading(true);
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const nextSession = sessionData.session;

    if (!mountedRef.current) return;

    setAccessError("");
    setSession(nextSession);

    if (!nextSession) {
      setIsAdmin(false);
      setNeedsPasswordSetup(false);
      setLoading(false);
      return;
    }

    const { data: adminData, error } = await supabase
      .from("admin_users")
      .select("is_active,needs_password_setup")
      .eq("user_id", nextSession.user.id)
      .maybeSingle();

    if (!mountedRef.current) return;

    if (error) {
      setAccessError(error.message);
      await clearRejectedSession();
      setLoading(false);
      return;
    }

    if (!adminData || !adminData.is_active) {
      setAccessError(
        adminData ? "Your admin access has been disabled." : "You do not have admin access.",
      );
      await clearRejectedSession();
      setLoading(false);
      return;
    }

    setIsAdmin(true);
    setNeedsPasswordSetup(Boolean(adminData.needs_password_setup));
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refreshAccess({ showLoading: true });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshAccess();
    });

    const refreshVisibleAccess = () => {
      if (document.visibilityState === "visible") {
        void refreshAccess();
      }
    };

    window.addEventListener("focus", refreshVisibleAccess);
    document.addEventListener("visibilitychange", refreshVisibleAccess);
    const accessCheckInterval = window.setInterval(refreshVisibleAccess, 30000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("focus", refreshVisibleAccess);
      document.removeEventListener("visibilitychange", refreshVisibleAccess);
      window.clearInterval(accessCheckInterval);
      subscription.unsubscribe();
    };
  }, [refreshAccess]);

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

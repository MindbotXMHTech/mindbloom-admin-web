import {
  createContext,
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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessError, setAccessError] = useState("");

  const syncSession = async (nextSession: Session | null) => {
    setLoading(true);
    setAccessError("");
    setSession(nextSession);

    if (!nextSession) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("admin_users")
      .select("role,is_active,email")
      .eq("user_id", nextSession.user.id)
      .maybeSingle();

    if (error) {
      setIsAdmin(false);
      setSession(null);
      setAccessError(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setIsAdmin(false);
      setSession(null);
      setAccessError("You do not have admin access.");
      setLoading(false);
      return;
    }

    if (!data.is_active) {
      setIsAdmin(false);
      setSession(null);
      setAccessError("Your admin access has been disabled.");
      setLoading(false);
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      syncSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        syncSession(nextSession);
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      loading,
      accessError,
      session,
      user: session?.user ?? null,
      isAdmin,
      signOut,
    }),
    [accessError, isAdmin, loading, session],
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

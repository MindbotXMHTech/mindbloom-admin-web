import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { LoadingScreen } from "../components/ui/loading";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session, isAdmin, needsPasswordSetup, refreshAccess } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (session) {
      void refreshAccess();
    }
  }, [location.pathname, refreshAccess, session]);

  if (loading) {
    return (
      <LoadingScreen
        eyebrow="Loading"
        title="Checking access"
        description="Preparing your admin session and access rules."
      />
    );
  }

  if (!session || !isAdmin) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (needsPasswordSetup) {
    return <Navigate to="/reset-password" replace />;
  }

  return children;
}

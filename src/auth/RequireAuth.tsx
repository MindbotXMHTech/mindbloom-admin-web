import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { LoadingScreen } from "../components/ui/loading";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session, isAdmin } = useAuth();
  const location = useLocation();

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

  return children;
}

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth/store";

interface Props {
  children: ReactNode;
}

export function SuperadminGuard({ children }: Props): JSX.Element {
  const { user } = useAuth();
  if (user?.isSuperAdmin !== true) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useIsAuthenticated } from "./store";

interface Props {
  children: ReactNode;
}

export function RequireAuth({ children }: Props): JSX.Element {
  const isAuthed = useIsAuthenticated();
  const location = useLocation();
  if (!isAuthed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

export function RedirectIfAuthed({ children }: Props): JSX.Element {
  const isAuthed = useIsAuthenticated();
  if (isAuthed) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

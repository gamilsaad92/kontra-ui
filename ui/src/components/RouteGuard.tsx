import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

type Props = { roles?: string[]; children: ReactNode };

export default function RouteGuard({ roles, children }: Props) {
  const { isLoaded, isSignedIn, user } = useUser();
  const location = useLocation();

  if (!isLoaded) return null; // or a spinner
  if (!isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role =
    (user?.publicMetadata?.role as string) ||
    (user?.unsafeMetadata?.role as string) ||
    "guest";

  if (roles && !roles.includes(role)) {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
}

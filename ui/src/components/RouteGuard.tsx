import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession, useRole } from '../lib/auth';

interface RouteGuardProps {
  roles?: string[];
  children: ReactNode;
}

export default function RouteGuard({ roles, children }: RouteGuardProps) {
  const session = useSession();
  const role = useRole();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (roles && role && !roles.includes(role)) {
    return <div>403 - Forbidden</div>;
  }

  return <>{children}</>;
}

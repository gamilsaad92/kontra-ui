import { ReactNode } from "react";

// Simplified RouteGuard while Clerk is disabled

type Props = { roles?: string[]; children: ReactNode };
export default function RouteGuard({ children }: Props) {
  return <>{children}</>;
}

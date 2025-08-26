import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";

export function useAuthToken() {
  const { isLoaded, getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (isLoaded) {
      getToken().then((t) => setToken(t ?? null));
      }
}, [isLoaded, getToken]);
  return token;
}

export function useRole(): string {
  const { user } = useUser();
   return (
    (user?.publicMetadata?.role as string) ||
    (user?.unsafeMetadata?.role as string) ||
    "guest"
  );
}

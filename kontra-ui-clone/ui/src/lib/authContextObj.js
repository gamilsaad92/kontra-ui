import { createContext } from "react";

export const AuthContext = createContext({
  session:      null,
  loading:      true,
  user:         null,
  supabase:     null,
  isLoading:    true,
  initializing: true,
  isAuthed:     false,
  isDemo:       false,
  signIn:       async () => ({ data: null, error: new Error("Not configured") }),
  loginAsDemo:  async () => ({ data: null, error: new Error("Not configured") }),
  signOut:      async () => ({ error: null }),
});

import { createContext } from 'react';

// Provide a default shape so consumers can safely destructure
// without hitting "Cannot access uninitialized variable" errors
export const AuthContext = createContext({ session: null, supabase: null });

import AsyncStorage from "@react-native-async-storage/async-storage";
  import React, { createContext, useContext, useEffect, useState } from "react";
  export type UserRole = "investor" | "borrower" | null;
  interface User { id: string; name: string; email: string; role: UserRole; avatar?: string; portfolioValue?: number; loanCount?: number; }
  interface AuthContextType { user: User | null; isLoading: boolean; login: (email: string, password: string, role: UserRole) => Promise<void>; logout: () => Promise<void>; switchRole: (role: UserRole) => void; }
  const AuthContext = createContext<AuthContextType | undefined>(undefined);
  const MOCK_USERS: Record<string, User> = {
    investor: { id: "inv_001", name: "Michael Chen", email: "mchen@capitalgroup.com", role: "investor", portfolioValue: 12450000, loanCount: 8 },
    borrower: { id: "bor_001", name: "Sarah Williams", email: "swilliams@realestate.com", role: "borrower", loanCount: 3 },
  };
  export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => { AsyncStorage.getItem("kontra_user").then((stored) => { if (stored) { try { setUser(JSON.parse(stored)); } catch {} } setIsLoading(false); }); }, []);
    const login = async (email: string, _password: string, role: UserRole) => { const mockUser = role ? MOCK_USERS[role] : null; const u = mockUser ? { ...mockUser, email } : null; if (u) { setUser(u); await AsyncStorage.setItem("kontra_user", JSON.stringify(u)); } };
    const logout = async () => { setUser(null); await AsyncStorage.removeItem("kontra_user"); };
    const switchRole = (role: UserRole) => { if (!role) return; const u = { ...MOCK_USERS[role] }; setUser(u); AsyncStorage.setItem("kontra_user", JSON.stringify(u)); };
    return <AuthContext.Provider value={{ user, isLoading, login, logout, switchRole }}>{children}</AuthContext.Provider>;
  }
  export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error("useAuth must be used within AuthProvider"); return ctx; }
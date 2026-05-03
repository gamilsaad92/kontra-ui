import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type DemoRole = "investor" | "borrower";
type Role = DemoRole;

const ROLES: { id: Role; label: string; desc: string; color: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "investor", label: "Investor", desc: "View portfolio & distributions", color: "#6d28d9", icon: "trending-up" },
  { id: "borrower", label: "Borrower", desc: "Manage loans & documents", color: "#059669", icon: "home" },
];

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, loginAsDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("investor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDemoLogin = async (role: DemoRole) => {
    setLoading(true);
    try {
      await loginAsDemo(role);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>K</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Kontra</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            CRE Loan Servicing Platform
          </Text>
        </View>

        {/* Demo access strip */}
        <View style={[styles.demoSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.demoLabel, { color: colors.mutedForeground }]}>No account? Try demo</Text>
          <View style={styles.demoRow}>
            <TouchableOpacity
              style={[styles.demoBtn, { backgroundColor: "#6d28d920", borderColor: "#6d28d9" }]}
              onPress={() => handleDemoLogin("investor")}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Feather name="trending-up" size={14} color="#6d28d9" />
              <Text style={[styles.demoBtnText, { color: "#6d28d9" }]}>Investor Demo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoBtn, { backgroundColor: "#05966920", borderColor: "#059669" }]}
              onPress={() => handleDemoLogin("borrower")}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Feather name="home" size={14} color="#059669" />
              <Text style={[styles.demoBtnText, { color: "#059669" }]}>Borrower Demo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]}>
          <Text style={[styles.dividerText, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
            or sign in
          </Text>
        </View>

        <View style={styles.roleSection}>
          <Text style={[styles.roleLabel, { color: colors.mutedForeground }]}>Your role</Text>
          <View style={styles.roleRow}>
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.roleCard,
                  {
                    backgroundColor: selectedRole === role.id ? role.color + "15" : colors.card,
                    borderColor: selectedRole === role.id ? role.color : colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedRole(role.id);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.roleIconBox, { backgroundColor: role.color + "20" }]}>
                  <Feather name={role.icon} size={20} color={role.color} />
                </View>
                <Text style={[styles.roleTitle, { color: colors.foreground }]}>{role.label}</Text>
                <Text style={[styles.roleDesc, { color: colors.mutedForeground }]}>{role.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.loginBtn,
              { backgroundColor: selectedRole === "investor" ? "#6d28d9" : "#059669" },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Sign in with your Kontra account credentials.{"\n"}Your role is assigned by your organization.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 36 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  logoText: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff" },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  roleSection: { marginBottom: 24 },
  roleLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  roleRow: { flexDirection: "row", gap: 12 },
  roleCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  roleIconBox: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  roleTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  roleDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  form: { gap: 12, marginBottom: 20 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  loginBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  hint: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  demoSection: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 8 },
  demoLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, textAlign: "center" },
  demoRow: { flexDirection: "row", gap: 10 },
  demoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  demoBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1, marginVertical: 20, position: "relative", alignItems: "center", justifyContent: "center" },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular", paddingHorizontal: 12, position: "absolute" },
});

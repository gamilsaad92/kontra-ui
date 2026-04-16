import { Feather } from "@expo/vector-icons";
  import * as Haptics from "expo-haptics";
  import { router } from "expo-router";
  import React, { useState } from "react";
  import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { useAuth } from "@/context/AuthContext";
  import { useColors } from "@/hooks/useColors";

  type Role = "investor" | "borrower";
  const ROLES: { id: Role; label: string; desc: string; color: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: "investor", label: "Investor", desc: "View portfolio & distributions", color: "#6d28d9", icon: "trending-up" },
    { id: "borrower", label: "Borrower", desc: "Manage loans & documents", color: "#059669", icon: "home" },
  ];

  export default function LoginScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [selectedRole, setSelectedRole] = useState<Role>("investor");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async () => {
      if (!email || !password) { setError("Please enter your email and password"); return; }
      setLoading(true); setError("");
      try {
        await login(email, password, selectedRole);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      } catch { setError("Login failed. Please try again."); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
      finally { setLoading(false); }
    };

    return (
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
              <Text style={styles.logoText}>K</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Kontra</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>CRE Loan Servicing Platform</Text>
          </View>
          <View style={styles.roleSection}>
            <Text style={[styles.roleLabel, { color: colors.mutedForeground }]}>Sign in as</Text>
            <View style={styles.roleRow}>
              {ROLES.map((role) => (
                <TouchableOpacity key={role.id}
                  style={[styles.roleCard, { backgroundColor: selectedRole === role.id ? role.color + "15" : colors.card, borderColor: selectedRole === role.id ? role.color : colors.border }]}
                  onPress={() => { setSelectedRole(role.id); Haptics.selectionAsync(); }} activeOpacity={0.8}>
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
              <TextInput style={[styles.input, { color: colors.foreground }]} placeholder="Email address" placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
            </View>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: colors.foreground }]} placeholder="Password" placeholderTextColor={colors.mutedForeground} value={password} onChangeText={setPassword} secureTextEntry />
            </View>
            {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
            <TouchableOpacity style={[styles.loginBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]} onPress={handleLogin} activeOpacity={0.85} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
            </TouchableOpacity>
          </View>
          <Text style={[styles.demo, { color: colors.mutedForeground }]}>Demo: any email + any password</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const styles = StyleSheet.create({
    flex: { flex: 1 }, container: { paddingHorizontal: 24 },
    header: { alignItems: "center", marginBottom: 36 },
    logoBox: { width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    logoText: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff" },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 4 },
    subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
    roleSection: { marginBottom: 24 },
    roleLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
    roleRow: { flexDirection: "row", gap: 12 },
    roleCard: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 14, gap: 6 },
    roleIconBox: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    roleTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    roleDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
    form: { gap: 12, marginBottom: 20 },
    inputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 50 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    error: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
    loginBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
    loginBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
    demo: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular" },
  });
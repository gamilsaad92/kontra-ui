import { Feather } from "@expo/vector-icons";
  import * as Haptics from "expo-haptics";
  import { router } from "expo-router";
  import React from "react";
  import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { KontraCard } from "@/components/KontraCard";
  import { useAuth } from "@/context/AuthContext";
  import { useColors } from "@/hooks/useColors";

  interface MenuItem { icon: keyof typeof Feather.glyphMap; label: string; sublabel?: string; onPress?: () => void; danger?: boolean; }

  export default function ProfileScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { user, logout, switchRole } = useAuth();
    const isWeb = Platform.OS === "web";
    if (!user) return null;
    const isInvestor = user.role === "investor";
    const accentColor = isInvestor ? colors.investor : colors.borrower;
    const accentLight = isInvestor ? colors.investorLight : colors.borrowerLight;

    const handleSwitchRole = () => { Haptics.selectionAsync(); switchRole(isInvestor ? "borrower" : "investor"); };
    const handleLogout = () => {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
      ]);
    };

    const menuGroups: { title: string; items: MenuItem[] }[] = [
      { title: "Account", items: [{ icon: "user", label: "Personal Information", sublabel: user.email }, { icon: "bell", label: "Notifications" }, { icon: "lock", label: "Security & Privacy" }] },
      { title: "Portfolio", items: [{ icon: "file-text", label: "Statements & Reports" }, { icon: "download", label: "Export Data" }, { icon: "calendar", label: "Tax Documents" }] },
      { title: "Support", items: [{ icon: "headphones", label: "Contact Servicer" }, { icon: "book-open", label: "Help Center" }, { icon: "info", label: "About Kontra" }] },
    ];

    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[s.container, { paddingTop: isWeb ? 83 : insets.top + 16, paddingBottom: isWeb ? 34 : insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <KontraCard style={s.heroCard} padding={20}>
          <View style={[s.avatarCircle, { backgroundColor: accentColor }]}>
            <Text style={s.avatarText}>{user.name.split(" ").map(n => n[0]).join("")}</Text>
          </View>
          <Text style={[s.userName, { color: colors.foreground }]}>{user.name}</Text>
          <Text style={[s.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
          <View style={[s.roleBadge, { backgroundColor: accentLight }]}>
            <Feather name={isInvestor ? "trending-up" : "home"} size={12} color={accentColor} />
            <Text style={[s.roleText, { color: accentColor }]}>{isInvestor ? "Investor" : "Borrower"}</Text>
          </View>
          {isInvestor ? (
            <View style={s.statsRow}>
              <View style={s.statItem}><Text style={[s.statVal, { color: colors.foreground }]}>$12.45M</Text><Text style={[s.statLbl, { color: colors.mutedForeground }]}>Portfolio</Text></View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.statItem}><Text style={[s.statVal, { color: colors.foreground }]}>8</Text><Text style={[s.statLbl, { color: colors.mutedForeground }]}>Loans</Text></View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.statItem}><Text style={[s.statVal, { color: colors.success }]}>+7.2%</Text><Text style={[s.statLbl, { color: colors.mutedForeground }]}>YTD</Text></View>
            </View>
          ) : (
            <View style={s.statsRow}>
              <View style={s.statItem}><Text style={[s.statVal, { color: colors.foreground }]}>$9.8M</Text><Text style={[s.statLbl, { color: colors.mutedForeground }]}>Total Debt</Text></View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.statItem}><Text style={[s.statVal, { color: colors.foreground }]}>3</Text><Text style={[s.statLbl, { color: colors.mutedForeground }]}>Loans</Text></View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.statItem}><Text style={[s.statVal, { color: colors.success }]}>Current</Text><Text style={[s.statLbl, { color: colors.mutedForeground }]}>Status</Text></View>
            </View>
          )}
        </KontraCard>
        <TouchableOpacity style={[s.switchBtn, { backgroundColor: accentLight, borderColor: accentColor }]} onPress={handleSwitchRole} activeOpacity={0.8}>
          <Feather name="repeat" size={16} color={accentColor} />
          <Text style={[s.switchText, { color: accentColor }]}>Switch to {isInvestor ? "Borrower" : "Investor"} View</Text>
        </TouchableOpacity>
        {menuGroups.map(group => (
          <View key={group.title} style={s.menuGroup}>
            <Text style={[s.groupTitle, { color: colors.mutedForeground }]}>{group.title}</Text>
            <KontraCard padding={0}>
              {group.items.map((item, i) => (
                <TouchableOpacity key={item.label} style={[s.menuItem, i < group.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]} onPress={item.onPress ?? (() => Haptics.selectionAsync())} activeOpacity={0.7}>
                  <View style={[s.menuIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name={item.icon} size={16} color={item.danger ? colors.destructive : colors.mutedForeground} />
                  </View>
                  <View style={s.menuBody}>
                    <Text style={[s.menuLabel, { color: item.danger ? colors.destructive : colors.foreground }]}>{item.label}</Text>
                    {item.sublabel && <Text style={[s.menuSub, { color: colors.mutedForeground }]}>{item.sublabel}</Text>}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </KontraCard>
          </View>
        ))}
        <TouchableOpacity style={[s.logoutBtn, { borderColor: colors.destructive }]} onPress={handleLogout} activeOpacity={0.8}>
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[s.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={[s.version, { color: colors.mutedForeground }]}>Kontra Mobile v1.0.0</Text>
      </ScrollView>
    );
  }

  const s = StyleSheet.create({
    container: { paddingHorizontal: 16 },
    heroCard: { marginBottom: 14, alignItems: "center" },
    avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    avatarText: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
    userName: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 3 },
    userEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 },
    roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 16 },
    roleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    statsRow: { flexDirection: "row", alignItems: "center", width: "100%" },
    statItem: { flex: 1, alignItems: "center", gap: 3 },
    statVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
    statLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
    divider: { width: 1, height: 32 },
    switchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 20 },
    switchText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    menuGroup: { marginBottom: 16 },
    groupTitle: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, paddingLeft: 2 },
    menuItem: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
    menuIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    menuBody: { flex: 1 },
    menuLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
    menuSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 10, borderWidth: 1.5, marginBottom: 12 },
    logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  });
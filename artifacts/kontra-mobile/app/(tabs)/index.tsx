import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KontraCard } from "@/components/KontraCard";
import { StatusBadge } from "@/components/StatusBadge";
import { SectionHeader } from "@/components/SectionHeader";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { usePortfolioData } from "@/hooks/usePortfolioData";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isWeb = Platform.OS === "web";
  const isInvestor = user?.role === "investor";
  const accentColor = isInvestor ? colors.investor : colors.borrower;
  const accentLight = isInvestor ? colors.investorLight : colors.borrowerLight;

  const { loans, activity, summary, loading, refresh, isLive } = usePortfolioData();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (!user) return (
    <View style={[s.center, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.foreground }}>Please log in</Text>
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[s.container, { paddingTop: (isWeb ? 67 : insets.top) + 16, paddingBottom: isWeb ? 34 : insets.bottom + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
    >
      {/* Hero card */}
      <View style={[s.hero, { backgroundColor: accentColor }]}>
        <View style={s.heroTop}>
          <View>
            <Text style={s.heroGreeting}>Good morning,</Text>
            <Text style={s.heroName}>{user.name.split(" ")[0]}</Text>
          </View>
          <View style={s.heroBadgeRow}>
            {isLive && (
              <View style={[s.liveDot, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                <View style={s.livePulse} />
                <Text style={s.liveText}>Live</Text>
              </View>
            )}
            <View style={[s.heroBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Text style={s.heroBadgeText}>{isInvestor ? "Investor" : "Borrower"}</Text>
            </View>
          </View>
        </View>
        {isInvestor ? (
          <View style={s.heroStats}>
            <View><Text style={s.heroLabel}>Portfolio Value</Text><Text style={s.heroValue}>${((summary.totalValue ?? 0) / 1_000_000).toFixed(2)}M</Text></View>
            <View style={s.heroSep} />
            <View><Text style={s.heroLabel}>Active Loans</Text><Text style={s.heroValue}>{summary.activeLoans ?? loans.length}</Text></View>
            <View style={s.heroSep} />
            <View><Text style={s.heroLabel}>YTD Return</Text><Text style={s.heroValue}>+{summary.ytdReturn ?? 7.2}%</Text></View>
          </View>
        ) : (
          <View style={s.heroStats}>
            <View><Text style={s.heroLabel}>Total Debt</Text><Text style={s.heroValue}>${((summary.totalDebt ?? 0) / 1_000_000).toFixed(1)}M</Text></View>
            <View style={s.heroSep} />
            <View><Text style={s.heroLabel}>Active Loans</Text><Text style={s.heroValue}>{summary.activeLoans ?? loans.length}</Text></View>
            <View style={s.heroSep} />
            <View><Text style={s.heroLabel}>Next Payment</Text><Text style={s.heroValue}>{summary.nextPaymentDate ?? "May 1"}</Text></View>
          </View>
        )}
      </View>

      {/* Quick actions */}
      <View style={s.quickActions}>
        {(isInvestor
          ? [{ icon: "bar-chart-2" as const, label: "Holdings", route: "/(tabs)/holdings" }, { icon: "clock" as const, label: "Activity", route: "/(tabs)/activity" }, { icon: "check-circle" as const, label: "Governance", route: "/(tabs)/governance" }, { icon: "user" as const, label: "Profile", route: "/(tabs)/profile" }]
          : [{ icon: "file-text" as const, label: "Requests", route: "/(tabs)/requests" }, { icon: "folder" as const, label: "Documents", route: "/(tabs)/documents" }, { icon: "message-circle" as const, label: "Messages", route: "/(tabs)/messages" }, { icon: "user" as const, label: "Profile", route: "/(tabs)/profile" }]
        ).map(a => (
          <TouchableOpacity key={a.label} style={[s.quickBtn, { backgroundColor: accentLight }]} onPress={() => { Haptics.selectionAsync(); router.push(a.route as any); }} activeOpacity={0.8}>
            <Feather name={a.icon} size={20} color={accentColor} />
            <Text style={[s.quickLabel, { color: accentColor }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loans */}
      <View style={s.section}>
        <SectionHeader title="Your Loans" action="See all" onAction={() => router.push(isInvestor ? "/(tabs)/holdings" : "/(tabs)/requests")} />
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={accentColor} size="small" />
            <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading loans…</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {loans.slice(0, 3).map(loan => (
              <KontraCard key={loan.id} padding={14}>
                <View style={s.loanTop}>
                  <View style={s.loanLeft}>
                    <Text style={[s.loanProp, { color: colors.foreground }]}>{loan.property}</Text>
                    <Text style={[s.loanType, { color: colors.mutedForeground }]}>{loan.type} · {loan.id}</Text>
                  </View>
                  <StatusBadge status={loan.status} size="sm" />
                </View>
                <View style={s.loanBottom}>
                  <View><Text style={[s.loanMetaLabel, { color: colors.mutedForeground }]}>Balance</Text><Text style={[s.loanMetaVal, { color: colors.foreground }]}>${(loan.balance / 1000000).toFixed(1)}M</Text></View>
                  <View><Text style={[s.loanMetaLabel, { color: colors.mutedForeground }]}>Rate</Text><Text style={[s.loanMetaVal, { color: colors.foreground }]}>{loan.rate}</Text></View>
                  <View><Text style={[s.loanMetaLabel, { color: colors.mutedForeground }]}>Maturity</Text><Text style={[s.loanMetaVal, { color: colors.foreground }]}>{loan.maturity}</Text></View>
                  {!isInvestor && loan.nextPayment && <View><Text style={[s.loanMetaLabel, { color: colors.mutedForeground }]}>Next Pmt</Text><Text style={[s.loanMetaVal, { color: accentColor }]}>{loan.nextPayment}</Text></View>}
                </View>
              </KontraCard>
            ))}
          </View>
        )}
      </View>

      {/* Activity */}
      <View style={s.section}>
        <SectionHeader title="Recent Activity" action="View all" onAction={() => router.push("/(tabs)/activity")} />
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={accentColor} size="small" />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {activity.slice(0, 4).map(item => (
              <KontraCard key={item.id} padding={12}>
                <View style={s.actRow}>
                  <View style={[s.actDot, { backgroundColor: accentLight }]}>
                    <Feather
                      name={item.type === "distribution" || item.type === "payment" ? "dollar-sign" : item.type === "document" ? "file" : item.type === "valuation" ? "trending-up" : "bell"}
                      size={14}
                      color={accentColor}
                    />
                  </View>
                  <View style={s.actBody}>
                    <Text style={[s.actDesc, { color: colors.foreground }]}>{item.title}</Text>
                    <Text style={[s.actDate, { color: colors.mutedForeground }]}>{item.date}</Text>
                  </View>
                  {item.amount && (
                    <Text style={[s.actAmount, { color: item.amount.startsWith("+") ? colors.success : colors.foreground }]}>{item.amount}</Text>
                  )}
                </View>
              </KontraCard>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { paddingHorizontal: 16 },
  hero: { borderRadius: 16, padding: 20, marginBottom: 16 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  heroGreeting: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontFamily: "Inter_400Regular" },
  heroName: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  heroBadgeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  liveDot: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ade80" },
  liveText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  heroStats: { flexDirection: "row", alignItems: "center" },
  heroSep: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 16 },
  heroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 3 },
  heroValue: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  quickActions: { flexDirection: "row", gap: 10, marginBottom: 24 },
  quickBtn: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 12, gap: 6 },
  quickLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  section: { marginBottom: 24 },
  loadingBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 24 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  loanTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  loanLeft: { flex: 1, marginRight: 8 },
  loanProp: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  loanType: { fontSize: 12, fontFamily: "Inter_400Regular" },
  loanBottom: { flexDirection: "row", gap: 16 },
  loanMetaLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  loanMetaVal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  actDot: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actBody: { flex: 1 },
  actDesc: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 1 },
  actDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  actAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

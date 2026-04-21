import { Feather } from "@expo/vector-icons";
  import * as Haptics from "expo-haptics";
  import { router } from "expo-router";
  import React from "react";
  import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { KontraCard } from "@/components/KontraCard";
  import { StatCard } from "@/components/StatCard";
  import { StatusBadge } from "@/components/StatusBadge";
  import { SectionHeader } from "@/components/SectionHeader";
  import { useAuth } from "@/context/AuthContext";
  import { useColors } from "@/hooks/useColors";

  const INVESTOR_LOANS = [
    { id: "L001", property: "550 Madison Ave", type: "Office", balance: 4200000, rate: "6.25%", status: "active" as const, maturity: "Dec 2026" },
    { id: "L002", property: "1 Harbor View", type: "Multi-Family", balance: 2800000, rate: "5.90%", status: "active" as const, maturity: "Mar 2027" },
    { id: "L003", property: "Westfield Mall E", type: "Retail", balance: 5450000, rate: "6.75%", status: "pending" as const, maturity: "Jun 2028" },
  ];
  const BORROWER_LOANS = [
    { id: "L004", property: "200 Commerce Dr", type: "Industrial", balance: 3100000, rate: "6.10%", status: "current" as const, maturity: "Aug 2027", nextPayment: "$18,450" },
    { id: "L005", property: "City Center Mixed", type: "Mixed-Use", balance: 1900000, rate: "5.75%", status: "current" as const, maturity: "Jan 2026", nextPayment: "$11,200" },
    { id: "L006", property: "Greenbrook Apts", type: "Multi-Family", balance: 4800000, rate: "6.50%", status: "review" as const, maturity: "Oct 2029", nextPayment: "$28,750" },
  ];
  const INVESTOR_ACTIVITY = [
    { id: "a1", type: "Distribution", amount: "+$24,500", date: "Apr 15", desc: "Q1 Distribution" },
    { id: "a2", type: "Valuation", amount: "$4.2M", date: "Apr 10", desc: "L001 Updated" },
    { id: "a3", type: "Report", amount: "—", date: "Apr 5", desc: "Q1 Investor Report" },
  ];
  const BORROWER_ACTIVITY = [
    { id: "a1", type: "Payment", amount: "-$18,450", date: "Apr 1", desc: "April Payment L004" },
    { id: "a2", type: "Document", amount: "—", date: "Mar 28", desc: "Insurance Upload" },
    { id: "a3", type: "Message", amount: "—", date: "Mar 25", desc: "Servicer replied" },
  ];

  export default function HomeScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [refreshing, setRefreshing] = React.useState(false);
    const isWeb = Platform.OS === "web";
    const isInvestor = user?.role === "investor";
    const loans = isInvestor ? INVESTOR_LOANS : BORROWER_LOANS;
    const activity = isInvestor ? INVESTOR_ACTIVITY : BORROWER_ACTIVITY;
    const accentColor = isInvestor ? colors.investor : colors.borrower;
    const accentLight = isInvestor ? colors.investorLight : colors.borrowerLight;

    const onRefresh = async () => { setRefreshing(true); await new Promise(r => setTimeout(r, 1000)); setRefreshing(false); };
    if (!user) return <View style={[s.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground }}>Please log in</Text></View>;

    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[s.container, { paddingTop: (isWeb ? 67 : insets.top) + 16, paddingBottom: isWeb ? 34 : insets.bottom + 16 }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}>
        <View style={[s.hero, { backgroundColor: accentColor }]}>
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroGreeting}>Good morning,</Text>
              <Text style={s.heroName}>{user.name.split(" ")[0]}</Text>
            </View>
            <View style={[s.heroBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Text style={s.heroBadgeText}>{isInvestor ? "Investor" : "Borrower"}</Text>
            </View>
          </View>
          {isInvestor ? (
            <View style={s.heroStats}>
              <View><Text style={s.heroLabel}>Portfolio Value</Text><Text style={s.heroValue}>$12.45M</Text></View>
              <View style={s.heroSep} />
              <View><Text style={s.heroLabel}>Active Loans</Text><Text style={s.heroValue}>{loans.length}</Text></View>
              <View style={s.heroSep} />
              <View><Text style={s.heroLabel}>YTD Return</Text><Text style={s.heroValue}>+7.2%</Text></View>
            </View>
          ) : (
            <View style={s.heroStats}>
              <View><Text style={s.heroLabel}>Total Debt</Text><Text style={s.heroValue}>$9.8M</Text></View>
              <View style={s.heroSep} />
              <View><Text style={s.heroLabel}>Active Loans</Text><Text style={s.heroValue}>{loans.length}</Text></View>
              <View style={s.heroSep} />
              <View><Text style={s.heroLabel}>Next Payment</Text><Text style={s.heroValue}>May 1</Text></View>
            </View>
          )}
        </View>

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

        <View style={s.section}>
          <SectionHeader title="Your Loans" action="See all" onAction={() => router.push(isInvestor ? "/(tabs)/holdings" : "/(tabs)/requests")} />
          <View style={{ gap: 10 }}>
            {loans.slice(0, 3).map(loan => (
              <KontraCard key={loan.id} padding={14}>
                <View style={s.loanTop}>
                  <View style={s.loanLeft}><Text style={[s.loanProp, { color: colors.foreground }]}>{loan.property}</Text><Text style={[s.loanType, { color: colors.mutedForeground }]}>{loan.type} · {loan.id}</Text></View>
                  <StatusBadge status={loan.status} size="sm" />
                </View>
                <View style={s.loanBottom}>
                  <View><Text style={[s.loanMetaLabel, { color: colors.mutedForeground }]}>Balance</Text><Text style={[s.loanMetaVal, { color: colors.foreground }]}>${(loan.balance/1000000).toFixed(1)}M</Text></View>
                  <View><Text style={[s.loanMetaLabel, { color: colors.mutedForeground }]}>Rate</Text><Text style={[s.loanMetaVal, { color: colors.foreground }]}>{loan.rate}</Text></View>
                  <View><Text style={[s.loanMetaLabel, { color: colors.mutedForeground }]}>Maturity</Text><Text style={[s.loanMetaVal, { color: colors.foreground }]}>{loan.maturity}</Text></View>
                  {!isInvestor && "nextPayment" in loan && <View><Text style={[s.loanMetaLabel, { color: colors.mutedForeground }]}>Next Pmt</Text><Text style={[s.loanMetaVal, { color: accentColor }]}>{(loan as any).nextPayment}</Text></View>}
                </View>
              </KontraCard>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <SectionHeader title="Recent Activity" action="View all" onAction={() => router.push("/(tabs)/activity")} />
          <View style={{ gap: 8 }}>
            {activity.map(item => (
              <KontraCard key={item.id} padding={12}>
                <View style={s.actRow}>
                  <View style={[s.actDot, { backgroundColor: accentLight }]}>
                    <Feather name={item.type === "Distribution" || item.type === "Payment" ? "dollar-sign" : item.type === "Document" ? "file" : "bell"} size={14} color={accentColor} />
                  </View>
                  <View style={s.actBody}><Text style={[s.actDesc, { color: colors.foreground }]}>{item.desc}</Text><Text style={[s.actDate, { color: colors.mutedForeground }]}>{item.date}</Text></View>
                  <Text style={[s.actAmount, { color: item.amount.startsWith("+") ? colors.success : colors.foreground }]}>{item.amount}</Text>
                </View>
              </KontraCard>
            ))}
          </View>
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
    heroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    heroBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
    heroStats: { flexDirection: "row", alignItems: "center" },
    heroSep: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 16 },
    heroLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 3 },
    heroValue: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
    quickActions: { flexDirection: "row", gap: 10, marginBottom: 24 },
    quickBtn: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 12, gap: 6 },
    quickLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    section: { marginBottom: 24 },
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
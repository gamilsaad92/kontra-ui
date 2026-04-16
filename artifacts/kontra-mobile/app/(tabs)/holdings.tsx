import { Feather } from "@expo/vector-icons";
  import React, { useState } from "react";
  import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { KontraCard } from "@/components/KontraCard";
  import { StatCard } from "@/components/StatCard";
  import { StatusBadge } from "@/components/StatusBadge";
  import { SectionHeader } from "@/components/SectionHeader";
  import { useColors } from "@/hooks/useColors";

  const HOLDINGS = [
    { id: "L001", property: "550 Madison Ave", city: "New York, NY", type: "Office", balance: 4200000, rate: 6.25, ltv: 65, status: "active" as const, maturity: "Dec 2026", ytd: 7.1, distributions: 84000 },
    { id: "L002", property: "1 Harbor View", city: "Miami, FL", type: "Multi-Family", balance: 2800000, rate: 5.9, ltv: 72, status: "active" as const, maturity: "Mar 2027", ytd: 6.8, distributions: 56000 },
    { id: "L003", property: "Westfield Mall E", city: "Chicago, IL", type: "Retail", balance: 5450000, rate: 6.75, ltv: 58, status: "pending" as const, maturity: "Jun 2028", ytd: 0, distributions: 0 },
    { id: "L004", property: "Gateway Office Park", city: "Austin, TX", type: "Office", balance: 3100000, rate: 6.0, ltv: 61, status: "active" as const, maturity: "Sep 2027", ytd: 6.2, distributions: 62000 },
  ];
  const TYPES = ["All", "Office", "Multi-Family", "Retail", "Industrial"];

  export default function HoldingsScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const isWeb = Platform.OS === "web";
    const [filter, setFilter] = useState("All");
    const [sortBy, setSortBy] = useState<"balance"|"rate"|"ytd">("balance");
    const filtered = HOLDINGS.filter(h => filter === "All" || h.type === filter).sort((a, b) => b[sortBy] - a[sortBy]);
    const totalValue = filtered.reduce((s, h) => s + h.balance, 0);
    const totalDist = filtered.reduce((s, h) => s + h.distributions, 0);

    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[s.container, { paddingTop: isWeb ? 83 : insets.top + 16, paddingBottom: isWeb ? 34 : insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={s.statsRow}>
          <StatCard label="Total Value" value={`$${(totalValue/1000000).toFixed(1)}M`} change="+7.2% YTD" positive accent={colors.investor} style={s.statFlex} />
          <StatCard label="YTD Distributions" value={`$${(totalDist/1000).toFixed(0)}K`} change="+12% vs LY" positive style={s.statFlex} />
        </View>
        <View style={s.statsRow}>
          <StatCard label="Avg Rate" value="6.21%" style={s.statFlex} />
          <StatCard label="Avg LTV" value="64%" style={s.statFlex} />
        </View>
        <View style={s.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setFilter(t)} style={[s.filterChip, { backgroundColor: filter === t ? colors.investor : colors.secondary, borderColor: filter === t ? colors.investor : colors.border }]} activeOpacity={0.8}>
                <Text style={[s.filterText, { color: filter === t ? "#fff" : colors.mutedForeground }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={s.sortRow}>
          <Text style={[s.sortLabel, { color: colors.mutedForeground }]}>Sort by:</Text>
          {(["balance","rate","ytd"] as const).map(sv => (
            <TouchableOpacity key={sv} onPress={() => setSortBy(sv)} style={[s.sortBtn, sortBy === sv && { borderBottomWidth: 2, borderBottomColor: colors.investor }]}>
              <Text style={[s.sortText, { color: sortBy === sv ? colors.investor : colors.mutedForeground }]}>{sv === "balance" ? "Balance" : sv === "rate" ? "Rate" : "YTD"}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SectionHeader title={`${filtered.length} Holdings`} />
        <View style={{ gap: 12 }}>
          {filtered.map(h => (
            <KontraCard key={h.id} padding={16}>
              <View style={s.cardTop}><View style={s.cardLeft}><Text style={[s.propName, { color: colors.foreground }]}>{h.property}</Text><Text style={[s.propCity, { color: colors.mutedForeground }]}>{h.city}</Text></View><StatusBadge status={h.status} size="sm" /></View>
              <View style={[s.typeTag, { backgroundColor: colors.investorLight }]}><Text style={[s.typeText, { color: colors.investor }]}>{h.type}</Text></View>
              <View style={s.metrics}>
                {[{ label: "Balance", value: `$${(h.balance/1000000).toFixed(1)}M` }, { label: "Rate", value: `${h.rate}%` }, { label: "LTV", value: `${h.ltv}%` }, { label: "YTD", value: h.ytd > 0 ? `+${h.ytd}%` : "—" }].map(m => (
                  <View key={m.label}><Text style={[s.metricLabel, { color: colors.mutedForeground }]}>{m.label}</Text><Text style={[s.metricVal, { color: colors.foreground }]}>{m.value}</Text></View>
                ))}
              </View>
              <View style={[s.footer, { borderTopColor: colors.border }]}>
                <Text style={[s.maturity, { color: colors.mutedForeground }]}>Matures {h.maturity}</Text>
                <TouchableOpacity style={[s.viewBtn, { borderColor: colors.investor }]} activeOpacity={0.8}><Text style={[s.viewBtnText, { color: colors.investor }]}>Details</Text><Feather name="chevron-right" size={14} color={colors.investor} /></TouchableOpacity>
              </View>
            </KontraCard>
          ))}
        </View>
      </ScrollView>
    );
  }

  const s = StyleSheet.create({
    container: { paddingHorizontal: 16 },
    statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
    statFlex: { flex: 1 },
    filters: { marginBottom: 12 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
    filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    sortRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    sortLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
    sortBtn: { paddingBottom: 4 },
    sortText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    cardLeft: { flex: 1, marginRight: 8 },
    propName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    propCity: { fontSize: 12, fontFamily: "Inter_400Regular" },
    typeTag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 12 },
    typeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    metrics: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    metricLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 },
    metricVal: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 10 },
    maturity: { fontSize: 12, fontFamily: "Inter_400Regular" },
    viewBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    viewBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  });
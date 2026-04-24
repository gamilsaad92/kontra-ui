import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KontraCard } from "@/components/KontraCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import type { ActivityItem } from "@/hooks/usePortfolioData";

type EventType = ActivityItem["type"];

const TYPE_CONFIG: Record<EventType, { icon: keyof typeof Feather.glyphMap; color: string; bg: string }> = {
  distribution: { icon: "dollar-sign", color: "#059669", bg: "#d1fae5" },
  payment:      { icon: "credit-card", color: "#d97706", bg: "#fef3c7" },
  document:     { icon: "file-text",   color: "#3b82f6", bg: "#dbeafe" },
  message:      { icon: "message-circle", color: "#8b5cf6", bg: "#ede9fe" },
  valuation:    { icon: "trending-up", color: "#6d28d9", bg: "#ede9fe" },
  alert:        { icon: "alert-circle", color: "#ef4444", bg: "#fee2e2" },
};

const FILTERS = ["All", "Payments", "Documents", "Messages"];

export default function ActivityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isWeb = Platform.OS === "web";
  const isInvestor = user?.role === "investor";
  const [filter, setFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const accentColor = isInvestor ? colors.investor : colors.borrower;

  const { activity, loading, refresh, isLive } = usePortfolioData();

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const items = activity.filter(item => {
    if (filter === "All") return true;
    if (filter === "Payments") return item.type === "distribution" || item.type === "payment";
    if (filter === "Documents") return item.type === "document";
    if (filter === "Messages") return item.type === "message" || item.type === "alert";
    return true;
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[s.container, { paddingTop: isWeb ? 83 : insets.top + 16, paddingBottom: isWeb ? 34 : insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
    >
      {isLive && (
        <View style={[s.liveBanner, { backgroundColor: accentColor + "18" }]}>
          <View style={[s.liveDot, { backgroundColor: "#22c55e" }]} />
          <Text style={[s.liveBannerText, { color: accentColor }]}>Activity synced from API</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[s.chip, { backgroundColor: filter === f ? accentColor : colors.secondary, borderColor: filter === f ? accentColor : colors.border }]}
            activeOpacity={0.8}
          >
            <Text style={[s.chipText, { color: filter === f ? "#fff" : colors.mutedForeground }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={accentColor} size="small" />
          <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading activity…</Text>
        </View>
      ) : (
        <>
          <Text style={[s.countLabel, { color: colors.mutedForeground }]}>{items.length} events</Text>
          <View style={{ gap: 8 }}>
            {items.map(item => {
              const cfg = TYPE_CONFIG[item.type];
              return (
                <TouchableOpacity key={item.id} activeOpacity={0.8}>
                  <KontraCard padding={14} style={!item.read ? { borderLeftWidth: 3, borderLeftColor: accentColor } as any : undefined}>
                    <View style={s.row}>
                      <View style={[s.icon, { backgroundColor: cfg.bg }]}>
                        <Feather name={cfg.icon} size={18} color={cfg.color} />
                      </View>
                      <View style={s.body}>
                        <Text style={[s.title, { color: colors.foreground }]}>{item.title}</Text>
                        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
                        <Text style={[s.date, { color: colors.mutedForeground }]}>{item.date}</Text>
                      </View>
                      {item.amount && (
                        <Text style={[s.amount, { color: item.amount.startsWith("+") ? colors.success : colors.destructive }]}>
                          {item.amount}
                        </Text>
                      )}
                    </View>
                  </KontraCard>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  liveBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveBannerText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterScroll: { marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  loadingBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  countLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  date: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  amount: { fontSize: 14, fontFamily: "Inter_700Bold" },
});

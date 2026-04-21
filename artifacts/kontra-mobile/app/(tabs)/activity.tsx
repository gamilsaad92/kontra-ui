import { Feather } from "@expo/vector-icons";
  import React, { useState } from "react";
  import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { KontraCard } from "@/components/KontraCard";
  import { useAuth } from "@/context/AuthContext";
  import { useColors } from "@/hooks/useColors";

  type EventType = "distribution" | "payment" | "document" | "message" | "valuation" | "alert";
  interface ActivityItem { id: string; type: EventType; title: string; subtitle: string; amount?: string; date: string; read: boolean; }

  const INVESTOR_ITEMS: ActivityItem[] = [
    { id: "1", type: "distribution", title: "Q1 Distribution Received", subtitle: "550 Madison Ave · L001", amount: "+$24,500", date: "Apr 15, 2026", read: true },
    { id: "2", type: "valuation", title: "Property Valuation Updated", subtitle: "1 Harbor View · L002", amount: "$2.8M", date: "Apr 10, 2026", read: true },
    { id: "3", type: "document", title: "Q1 Investor Report Ready", subtitle: "All holdings · PDF", date: "Apr 5, 2026", read: false },
    { id: "4", type: "distribution", title: "Q1 Distribution Received", subtitle: "Gateway Office Park · L004", amount: "+$18,200", date: "Apr 1, 2026", read: true },
    { id: "5", type: "alert", title: "Maturity Notice", subtitle: "550 Madison Ave matures Dec 2026", date: "Mar 28, 2026", read: true },
    { id: "7", type: "distribution", title: "Q4 Distribution Received", subtitle: "All holdings", amount: "+$89,400", date: "Jan 15, 2026", read: true },
  ];
  const BORROWER_ITEMS: ActivityItem[] = [
    { id: "1", type: "payment", title: "Monthly Payment Processed", subtitle: "200 Commerce Dr · L004", amount: "-$18,450", date: "Apr 1, 2026", read: true },
    { id: "2", type: "document", title: "Insurance Certificate Approved", subtitle: "Greenbrook Apts · L006", date: "Mar 28, 2026", read: false },
    { id: "3", type: "message", title: "Servicer Response", subtitle: "Re: Payoff Request", date: "Mar 25, 2026", read: false },
    { id: "4", type: "payment", title: "Monthly Payment Processed", subtitle: "City Center Mixed · L005", amount: "-$11,200", date: "Mar 1, 2026", read: true },
    { id: "5", type: "alert", title: "Document Required", subtitle: "Rent Roll due Apr 30", date: "Feb 15, 2026", read: true },
  ];
  const TYPE_CONFIG: Record<EventType, { icon: keyof typeof Feather.glyphMap; color: string; bg: string }> = {
    distribution: { icon: "dollar-sign", color: "#059669", bg: "#d1fae5" },
    payment: { icon: "credit-card", color: "#d97706", bg: "#fef3c7" },
    document: { icon: "file-text", color: "#3b82f6", bg: "#dbeafe" },
    message: { icon: "message-circle", color: "#8b5cf6", bg: "#ede9fe" },
    valuation: { icon: "trending-up", color: "#6d28d9", bg: "#ede9fe" },
    alert: { icon: "alert-circle", color: "#ef4444", bg: "#fee2e2" },
  };
  const FILTERS = ["All", "Payments", "Documents", "Messages"];

  export default function ActivityScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const isWeb = Platform.OS === "web";
    const isInvestor = user?.role === "investor";
    const [filter, setFilter] = useState("All");
    const accentColor = isInvestor ? colors.investor : colors.borrower;
    const items = (isInvestor ? INVESTOR_ITEMS : BORROWER_ITEMS).filter(item => {
      if (filter === "All") return true;
      if (filter === "Payments") return item.type === "distribution" || item.type === "payment";
      if (filter === "Documents") return item.type === "document";
      if (filter === "Messages") return item.type === "message" || item.type === "alert";
      return true;
    });

    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[s.container, { paddingTop: isWeb ? 83 : insets.top + 16, paddingBottom: isWeb ? 34 : insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[s.chip, { backgroundColor: filter === f ? accentColor : colors.secondary, borderColor: filter === f ? accentColor : colors.border }]} activeOpacity={0.8}>
              <Text style={[s.chipText, { color: filter === f ? "#fff" : colors.mutedForeground }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[s.countLabel, { color: colors.mutedForeground }]}>{items.length} events</Text>
        <View style={{ gap: 8 }}>
          {items.map(item => {
            const cfg = TYPE_CONFIG[item.type];
            return (
              <TouchableOpacity key={item.id} activeOpacity={0.8}>
                <KontraCard padding={14} style={!item.read ? { borderLeftWidth: 3, borderLeftColor: accentColor } as any : undefined}>
                  <View style={s.row}>
                    <View style={[s.icon, { backgroundColor: cfg.bg }]}><Feather name={cfg.icon} size={18} color={cfg.color} /></View>
                    <View style={s.body}>
                      <Text style={[s.title, { color: colors.foreground }]}>{item.title}</Text>
                      <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{item.subtitle}</Text>
                      <Text style={[s.date, { color: colors.mutedForeground }]}>{item.date}</Text>
                    </View>
                    {item.amount && <Text style={[s.amount, { color: item.amount.startsWith("+") ? colors.success : colors.destructive }]}>{item.amount}</Text>}
                  </View>
                </KontraCard>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  const s = StyleSheet.create({
    container: { paddingHorizontal: 16 },
    filterScroll: { marginBottom: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
    chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    countLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    icon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    body: { flex: 1, gap: 2 },
    title: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
    date: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
    amount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  });
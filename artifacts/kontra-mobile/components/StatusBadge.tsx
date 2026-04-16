import React from "react";
  import { StyleSheet, Text, View } from "react-native";

  type Status = "active" | "pending" | "closed" | "approved" | "review" | "rejected" | "current";
  interface Props { status: Status; size?: "sm" | "md"; }

  const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string }> = {
    active: { label: "Active", bg: "#d1fae5", text: "#065f46" },
    current: { label: "Current", bg: "#d1fae5", text: "#065f46" },
    pending: { label: "Pending", bg: "#fef3c7", text: "#92400e" },
    review: { label: "In Review", bg: "#dbeafe", text: "#1e40af" },
    approved: { label: "Approved", bg: "#d1fae5", text: "#065f46" },
    closed: { label: "Closed", bg: "#f3f4f6", text: "#374151" },
    rejected: { label: "Rejected", bg: "#fee2e2", text: "#991b1b" },
  };

  export function StatusBadge({ status, size = "md" }: Props) {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    const isSmall = size === "sm";
    return (
      <View style={[styles.badge, { backgroundColor: config.bg, paddingHorizontal: isSmall ? 6 : 10, paddingVertical: isSmall ? 2 : 4 }]}>
        <Text style={[styles.text, { color: config.text, fontSize: isSmall ? 10 : 12 }]}>{config.label}</Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    badge: { borderRadius: 20, alignSelf: "flex-start" },
    text: { fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
  });
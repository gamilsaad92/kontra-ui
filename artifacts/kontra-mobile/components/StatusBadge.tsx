import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type Status = "active" | "pending" | "closed" | "approved" | "review" | "rejected" | "current" | "watch" | "late";
interface Props { status: Status; size?: "sm" | "md"; }

const STATUS_LABELS: Record<Status, string> = {
  active: "Active",
  current: "Current",
  pending: "Pending",
  review: "In Review",
  approved: "Approved",
  closed: "Closed",
  rejected: "Rejected",
  watch: "Watch",
  late: "Late",
};

export function StatusBadge({ status, size = "md" }: Props) {
  const colors = useColors();
  const isSmall = size === "sm";
  const tone = {
    active: { bg: colors.borrowerLight, text: colors.borrower },
    current: { bg: colors.borrowerLight, text: colors.borrower },
    pending: { bg: colors.servicerLight, text: colors.servicer },
    review: { bg: `${colors.info}18`, text: colors.info },
    approved: { bg: `${colors.success}18`, text: colors.success },
    closed: { bg: colors.secondary, text: colors.mutedForeground },
    rejected: { bg: `${colors.destructive}18`, text: colors.destructive },
    watch: { bg: colors.servicerLight, text: colors.servicer },
    late: { bg: `${colors.destructive}18`, text: colors.destructive },
  }[status] ?? { bg: colors.secondary, text: colors.mutedForeground };

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, paddingHorizontal: isSmall ? 6 : 10, paddingVertical: isSmall ? 2 : 4 }]}>
      <Text style={[styles.text, { color: tone.text, fontSize: isSmall ? 10 : 12 }]}>{STATUS_LABELS[status] ?? "Pending"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 20, alignSelf: "flex-start" },
  text: { fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
});
import React from "react";
  import { StyleSheet, Text, ViewStyle } from "react-native";
  import { useColors } from "@/hooks/useColors";
  import { KontraCard } from "./KontraCard";

  interface Props {
    label: string;
    value: string;
    change?: string;
    positive?: boolean;
    accent?: string;
    style?: ViewStyle;
  }

  export function StatCard({ label, value, change, positive, accent, style }: Props) {
    const colors = useColors();
    return (
      <KontraCard style={style}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.value, { color: accent ?? colors.foreground }]}>{value}</Text>
        {change !== undefined && (
          <Text style={[styles.change, { color: positive ? colors.success : colors.destructive }]}>{change}</Text>
        )}
      </KontraCard>
    );
  }

  const styles = StyleSheet.create({
    label: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
    value: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 2 },
    change: { fontSize: 12, fontFamily: "Inter_500Medium" },
  });
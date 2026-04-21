import React from "react";
  import { StyleSheet, View, ViewStyle } from "react-native";
  import { useColors } from "@/hooks/useColors";

  interface Props {
    children: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
    padding?: number;
  }

  export function KontraCard({ children, style, padding = 16 }: Props) {
    const colors = useColors();
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, padding }, style]}>
        {children}
      </View>
    );
  }

  const styles = StyleSheet.create({
    card: { borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  });
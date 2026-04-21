import { BlurView } from "expo-blur";
  import { Tabs } from "expo-router";
  import { Feather } from "@expo/vector-icons";
  import { SymbolView } from "expo-symbols";
  import React from "react";
  import { Platform, StyleSheet, View, useColorScheme } from "react-native";
  import { useAuth } from "@/context/AuthContext";
  import { useColors } from "@/hooks/useColors";

  function ClassicTabLayout() {
    const colors = useColors();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const isIOS = Platform.OS === "ios";
    const isWeb = Platform.OS === "web";
    const { user } = useAuth();
    const isInvestor = user?.role === "investor";
    const accentColor = isInvestor ? colors.investor : colors.borrower;

    const investorTabs = [
      { name: "index", title: "Home", sfIcon: "house", sfIconFill: "house.fill", icon: "home" as const },
      { name: "holdings", title: "Holdings", sfIcon: "chart.bar", sfIconFill: "chart.bar.fill", icon: "bar-chart-2" as const },
      { name: "activity", title: "Activity", sfIcon: "clock", sfIconFill: "clock.fill", icon: "clock" as const },
      { name: "governance", title: "Vote", sfIcon: "checkmark.circle", sfIconFill: "checkmark.circle.fill", icon: "check-circle" as const },
      { name: "profile", title: "Profile", sfIcon: "person", sfIconFill: "person.fill", icon: "user" as const },
    ];
    const borrowerTabs = [
      { name: "index", title: "Home", sfIcon: "house", sfIconFill: "house.fill", icon: "home" as const },
      { name: "requests", title: "Requests", sfIcon: "doc.text", sfIconFill: "doc.text.fill", icon: "file-text" as const },
      { name: "documents", title: "Documents", sfIcon: "folder", sfIconFill: "folder.fill", icon: "folder" as const },
      { name: "messages", title: "Messages", sfIcon: "message", sfIconFill: "message.fill", icon: "message-circle" as const },
      { name: "profile", title: "Profile", sfIcon: "person", sfIconFill: "person.fill", icon: "user" as const },
    ];
    const hiddenTabs = isInvestor ? ["requests", "documents", "messages"] : ["holdings", "governance", "activity"];
    const allTabs = [...investorTabs, ...borrowerTabs.filter(t => !investorTabs.find(it => it.name === t.name))];

    return (
      <Tabs screenOptions={{
        tabBarActiveTintColor: accentColor,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: { position: "absolute", backgroundColor: isIOS ? "transparent" : colors.background, borderTopWidth: 1, borderTopColor: colors.border, elevation: 0, height: isWeb ? 84 : 60 },
        tabBarBackground: () => isIOS ? <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : isWeb ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} /> : null,
        tabBarLabelStyle: { fontSize: 10, fontFamily: "Inter_500Medium" },
      }}>
        {allTabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{
            title: tab.title,
            href: hiddenTabs.includes(tab.name) ? null : undefined,
            tabBarIcon: ({ color }) => isIOS ? <SymbolView name={tab.sfIcon} tintColor={color} size={22} /> : <Feather name={tab.icon} size={22} color={color} />,
          }} />
        ))}
      </Tabs>
    );
  }

  export default function TabLayout() {
    return <ClassicTabLayout />;
  }
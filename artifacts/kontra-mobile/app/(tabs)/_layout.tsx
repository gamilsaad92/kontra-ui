import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme, Text } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function NativeTabLayoutInvestor() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="holdings">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Holdings</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <Icon sf={{ default: "clock", selected: "clock.fill" }} />
        <Label>Activity</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="governance">
        <Icon sf={{ default: "checkmark.circle", selected: "checkmark.circle.fill" }} />
        <Label>Vote</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function NativeTabLayoutBorrower() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="requests">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>Requests</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="documents">
        <Icon sf={{ default: "folder", selected: "folder.fill" }} />
        <Label>Documents</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="messages">
        <Icon sf={{ default: "message", selected: "message.fill" }} />
        <Label>Messages</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

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

  const hiddenTabs = isInvestor
    ? ["requests", "documents", "messages"]
    : ["holdings", "governance", "activity"];

  const tabs = isInvestor ? investorTabs : borrowerTabs;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: accentColor,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 60,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
        tabBarLabelStyle: { fontSize: 10, fontFamily: "Inter_500Medium" },
      }}
    >
      {[...investorTabs, ...borrowerTabs.filter(t => !investorTabs.find(it => it.name === t.name))].map((tab) => {
        const isHidden = hiddenTabs.includes(tab.name);
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              href: isHidden ? null : undefined,
              tabBarIcon: ({ color }) =>
                isIOS ? (
                  <SymbolView name={tab.sfIcon} tintColor={color} size={22} />
                ) : (
                  <Feather name={tab.icon} size={22} color={color} />
                ),
            }}
          />
        );
      })}
    </Tabs>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const isInvestor = user?.role === "investor";

  if (isLiquidGlassAvailable()) {
    return isInvestor ? <NativeTabLayoutInvestor /> : <NativeTabLayoutBorrower />;
  }
  return <ClassicTabLayout />;
}

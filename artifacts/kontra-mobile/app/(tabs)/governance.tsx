import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KontraCard } from "@/components/KontraCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useColors } from "@/hooks/useColors";

type VoteChoice = "approve" | "reject" | null;

interface Proposal {
  id: string;
  title: string;
  description: string;
  loan: string;
  type: string;
  deadline: string;
  votes: { approve: number; reject: number; total: number };
  status: "active" | "closed" | "pending";
  myVote: VoteChoice;
}

const INITIAL_PROPOSALS: Proposal[] = [
  {
    id: "P001",
    title: "Loan Modification — 550 Madison",
    description: "Requesting 6-month extension on maturity with 25bps rate increase. Borrower has demonstrated strong DSCR of 1.42x.",
    loan: "L001",
    type: "Modification",
    deadline: "Apr 30, 2026",
    votes: { approve: 7, reject: 2, total: 12 },
    status: "active",
    myVote: null,
  },
  {
    id: "P002",
    title: "Advance Approval — Harbor View Capital Repairs",
    description: "$185,000 advance for roof replacement and HVAC upgrades. Work to be completed within 90 days.",
    loan: "L002",
    type: "Advance",
    deadline: "May 5, 2026",
    votes: { approve: 5, reject: 1, total: 8 },
    status: "active",
    myVote: null,
  },
  {
    id: "P003",
    title: "Partial Release — Gateway Office",
    description: "Release of Building C from collateral following partial paydown of $450K.",
    loan: "L004",
    type: "Release",
    deadline: "Apr 20, 2026",
    votes: { approve: 10, reject: 3, total: 13 },
    status: "closed",
    myVote: "approve",
  },
];

export default function GovernanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [proposals, setProposals] = useState<Proposal[]>(INITIAL_PROPOSALS);
  const [filter, setFilter] = useState<"all" | "pending" | "closed">("all");

  const castVote = (id: string, choice: VoteChoice) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProposals((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              myVote: choice,
              votes: {
                ...p.votes,
                approve: choice === "approve" ? p.votes.approve + 1 : p.votes.approve,
                reject: choice === "reject" ? p.votes.reject + 1 : p.votes.reject,
              },
            }
          : p
      )
    );
  };

  const filtered = proposals.filter((p) => {
    if (filter === "pending") return p.status === "active" && !p.myVote;
    if (filter === "closed") return p.status === "closed" || !!p.myVote;
    return true;
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: isWeb ? 83 : insets.top + 16,
          paddingBottom: isWeb ? 34 : insets.bottom + 80,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <KontraCard style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          {[
            { label: "Active Proposals", value: proposals.filter((p) => p.status === "active").length.toString(), color: colors.investor },
            { label: "Your Votes Pending", value: proposals.filter((p) => p.status === "active" && !p.myVote).length.toString(), color: colors.warning },
            { label: "Voted This Month", value: proposals.filter((p) => p.myVote).length.toString(), color: colors.success },
          ].map((s) => (
            <View key={s.label} style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      </KontraCard>

      <View style={styles.filterRow}>
        {(["all", "pending", "closed"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterBtn,
              { backgroundColor: filter === f ? colors.investor : colors.secondary, borderColor: filter === f ? colors.investor : colors.border },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, { color: filter === f ? "#fff" : colors.mutedForeground }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ gap: 14 }}>
        {filtered.map((p) => {
          const approvePercent = p.votes.total > 0 ? (p.votes.approve / p.votes.total) * 100 : 0;
          const isClosed = p.status === "closed" || !!p.myVote;

          return (
            <KontraCard key={p.id} padding={16}>
              <View style={styles.propHeader}>
                <View style={[styles.typeTag, { backgroundColor: colors.investorLight }]}>
                  <Text style={[styles.typeText, { color: colors.investor }]}>{p.type}</Text>
                </View>
                <StatusBadge status={p.status === "active" ? "active" : "closed"} size="sm" />
              </View>
              <Text style={[styles.propTitle, { color: colors.foreground }]}>{p.title}</Text>
              <Text style={[styles.propDesc, { color: colors.mutedForeground }]}>{p.description}</Text>
              <Text style={[styles.propMeta, { color: colors.mutedForeground }]}>Loan {p.loan} · Deadline {p.deadline}</Text>

              <View style={styles.voteBar}>
                <View style={[styles.voteTrack, { backgroundColor: colors.secondary }]}>
                  <View style={[styles.voteFill, { width: `${approvePercent}%`, backgroundColor: colors.success }]} />
                </View>
                <View style={styles.voteLabels}>
                  <Text style={[styles.voteLabel, { color: colors.success }]}>{p.votes.approve} Approve</Text>
                  <Text style={[styles.voteLabel, { color: colors.mutedForeground }]}>{p.votes.total - p.votes.approve - p.votes.reject} Pending</Text>
                  <Text style={[styles.voteLabel, { color: colors.destructive }]}>{p.votes.reject} Reject</Text>
                </View>
              </View>

              {!isClosed ? (
                <View style={styles.voteActions}>
                  <TouchableOpacity
                    style={[styles.voteBtn, { backgroundColor: colors.success + "20", borderColor: colors.success }]}
                    onPress={() => castVote(p.id, "approve")}
                    activeOpacity={0.8}
                  >
                    <Feather name="check" size={16} color={colors.success} />
                    <Text style={[styles.voteBtnText, { color: colors.success }]}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.voteBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive }]}
                    onPress={() => castVote(p.id, "reject")}
                    activeOpacity={0.8}
                  >
                    <Feather name="x" size={16} color={colors.destructive} />
                    <Text style={[styles.voteBtnText, { color: colors.destructive }]}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.votedRow}>
                  <Feather name="check-circle" size={14} color={colors.success} />
                  <Text style={[styles.votedText, { color: colors.success }]}>
                    You voted: {p.myVote === "approve" ? "Approve" : "Reject"}
                  </Text>
                </View>
              )}
            </KontraCard>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 0 },
  summaryCard: { marginBottom: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-around" },
  summaryItem: { alignItems: "center", gap: 4 },
  summaryVal: { fontSize: 24, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  propHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  typeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  propTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  propDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 8 },
  propMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 12 },
  voteBar: { marginBottom: 12 },
  voteTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  voteFill: { height: "100%", borderRadius: 3 },
  voteLabels: { flexDirection: "row", justifyContent: "space-between" },
  voteLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  voteActions: { flexDirection: "row", gap: 10 },
  voteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  voteBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  votedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  votedText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

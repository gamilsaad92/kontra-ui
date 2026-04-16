import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KontraCard } from "@/components/KontraCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useColors } from "@/hooks/useColors";

type RequestType = "payoff" | "modification" | "extension" | "advance" | "other";

interface LoanRequest {
  id: string;
  type: RequestType;
  loan: string;
  property: string;
  description: string;
  submittedDate: string;
  status: "pending" | "review" | "approved" | "rejected";
  response?: string;
}

const TYPE_LABELS: Record<RequestType, string> = {
  payoff: "Payoff Quote",
  modification: "Loan Modification",
  extension: "Maturity Extension",
  advance: "Draw / Advance",
  other: "General Inquiry",
};

const INITIAL_REQUESTS: LoanRequest[] = [
  { id: "R001", type: "payoff", loan: "L004", property: "200 Commerce Dr", description: "Requesting payoff quote valid for 30 days for potential sale of property.", submittedDate: "Apr 10, 2026", status: "review" },
  { id: "R002", type: "extension", loan: "L005", property: "City Center Mixed", description: "Requesting 12-month maturity extension due to market conditions.", submittedDate: "Mar 28, 2026", status: "pending" },
  { id: "R003", type: "advance", loan: "L006", property: "Greenbrook Apts", description: "Draw request for $120,000 for Phase 2 renovation work.", submittedDate: "Mar 15, 2026", status: "approved", response: "Draw approved. Funds will be disbursed within 3 business days." },
];

const REQUEST_TYPES: { id: RequestType; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { id: "payoff", icon: "dollar-sign", label: "Payoff Quote" },
  { id: "modification", icon: "edit", label: "Modification" },
  { id: "extension", icon: "clock", label: "Extension" },
  { id: "advance", icon: "download", label: "Draw / Advance" },
  { id: "other", icon: "help-circle", label: "Inquiry" },
];

export default function RequestsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [requests, setRequests] = useState<LoanRequest[]>(INITIAL_REQUESTS);
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<RequestType>("payoff");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    const newReq: LoanRequest = {
      id: `R${Date.now()}`,
      type: selectedType,
      loan: "L004",
      property: "200 Commerce Dr",
      description: description.trim(),
      submittedDate: "Apr 16, 2026",
      status: "pending",
    };
    setRequests((prev) => [newReq, ...prev]);
    setDescription("");
    setSubmitting(false);
    setShowModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <>
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
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.borrower }]}
          onPress={() => { setShowModal(true); Haptics.selectionAsync(); }}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.newBtnText}>New Request</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{requests.length} requests</Text>

        <View style={{ gap: 12 }}>
          {requests.map((req) => (
            <KontraCard key={req.id} padding={16}>
              <View style={styles.reqHeader}>
                <View style={[styles.reqTypeBadge, { backgroundColor: colors.borrowerLight }]}>
                  <Text style={[styles.reqTypeText, { color: colors.borrower }]}>{TYPE_LABELS[req.type]}</Text>
                </View>
                <StatusBadge status={req.status} size="sm" />
              </View>
              <Text style={[styles.reqProp, { color: colors.foreground }]}>{req.property}</Text>
              <Text style={[styles.reqLoan, { color: colors.mutedForeground }]}>Loan {req.loan}</Text>
              <Text style={[styles.reqDesc, { color: colors.foreground }]}>{req.description}</Text>
              <Text style={[styles.reqDate, { color: colors.mutedForeground }]}>Submitted {req.submittedDate}</Text>
              {req.response && (
                <View style={[styles.responseBox, { backgroundColor: colors.borrowerLight, borderLeftColor: colors.borrower }]}>
                  <Text style={[styles.responseLabel, { color: colors.borrower }]}>Servicer Response</Text>
                  <Text style={[styles.responseText, { color: colors.foreground }]}>{req.response}</Text>
                </View>
              )}
            </KontraCard>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Request</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Request Type</Text>
            <View style={styles.typeGrid}>
              {REQUEST_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.typeOption,
                    { backgroundColor: selectedType === t.id ? colors.borrower : colors.secondary, borderColor: selectedType === t.id ? colors.borrower : colors.border },
                  ]}
                  onPress={() => { setSelectedType(t.id); Haptics.selectionAsync(); }}
                  activeOpacity={0.8}
                >
                  <Feather name={t.icon} size={18} color={selectedType === t.id ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.typeOptionText, { color: selectedType === t.id ? "#fff" : colors.foreground }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
            <TextInput
              style={[styles.textarea, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
              placeholder="Describe your request in detail..."
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.borrower }, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting || !description.trim()}
              activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 0 },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, marginBottom: 16 },
  newBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 },
  reqHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reqTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reqTypeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  reqProp: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  reqLoan: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 6 },
  reqDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 6 },
  reqDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  responseBox: { marginTop: 10, padding: 10, borderRadius: 8, borderLeftWidth: 3 },
  responseLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  responseText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  modalBody: { padding: 16, gap: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  typeOption: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  typeOptionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  textarea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 120, marginBottom: 8 },
  submitBtn: { padding: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

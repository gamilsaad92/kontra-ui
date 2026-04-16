import { Feather } from "@expo/vector-icons";
  import * as Haptics from "expo-haptics";
  import * as ImagePicker from "expo-image-picker";
  import React, { useState } from "react";
  import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { KontraCard } from "@/components/KontraCard";
  import { useColors } from "@/hooks/useColors";

  interface Doc { id: string; name: string; category: string; loan: string; date: string; size: string; status: "approved"|"pending"|"required"; }

  const INITIAL_DOCS: Doc[] = [
    { id: "D001", name: "Rent Roll Q1 2026.pdf", category: "Operating", loan: "L004", date: "Mar 31, 2026", size: "1.2 MB", status: "approved" },
    { id: "D002", name: "Insurance Certificate.pdf", category: "Insurance", loan: "L006", date: "Mar 28, 2026", size: "380 KB", status: "approved" },
    { id: "D003", name: "Financial Statements 2025.pdf", category: "Financial", loan: "L004", date: "Feb 28, 2026", size: "2.4 MB", status: "approved" },
    { id: "D004", name: "Appraisal Report.pdf", category: "Valuation", loan: "L005", date: "Jan 15, 2026", size: "8.7 MB", status: "approved" },
    { id: "D005", name: "Rent Roll Q2 2026.pdf", category: "Operating", loan: "L004", date: "—", size: "—", status: "required" },
    { id: "D006", name: "Insurance Renewal.pdf", category: "Insurance", loan: "L004", date: "—", size: "—", status: "required" },
  ];
  const CATEGORIES = ["All", "Operating", "Insurance", "Financial", "Valuation"];
  const STATUS_COLORS: Record<Doc["status"], { bg: string; text: string }> = { approved: { bg: "#d1fae5", text: "#065f46" }, pending: { bg: "#fef3c7", text: "#92400e" }, required: { bg: "#fee2e2", text: "#991b1b" } };
  const CAT_ICONS: Record<string, keyof typeof Feather.glyphMap> = { Operating: "list", Insurance: "shield", Financial: "bar-chart", Valuation: "home", default: "file" };

  export default function DocumentsScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const isWeb = Platform.OS === "web";
    const [docs, setDocs] = useState<Doc[]>(INITIAL_DOCS);
    const [filter, setFilter] = useState("All");
    const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
    const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();
    const filtered = docs.filter(d => filter === "All" || d.category === filter);
    const required = docs.filter(d => d.status === "required").length;

    const handleUpload = async () => {
      Haptics.selectionAsync();
      if (Platform.OS === "web") { Alert.alert("Upload", "File upload is available on the mobile app."); return; }
      if (!mediaPermission?.granted) { const res = await requestMediaPermission(); if (!res.granted) return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets.length > 0) {
        const fname = result.assets[0].fileName ?? `upload_${Date.now()}.jpg`;
        setDocs(prev => [{ id: `D${Date.now()}`, name: fname, category: "Operating", loan: "L004", date: "Apr 16, 2026", size: "—", status: "pending" }, ...prev]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    const handleCamera = async () => {
      Haptics.selectionAsync();
      if (Platform.OS === "web") { Alert.alert("Camera", "Camera capture is available on the mobile app."); return; }
      if (!cameraPermission?.granted) { const res = await requestCameraPermission(); if (!res.granted) return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets.length > 0) {
        setDocs(prev => [{ id: `D${Date.now()}`, name: `scan_${Date.now()}.jpg`, category: "Operating", loan: "L004", date: "Apr 16, 2026", size: "—", status: "pending" }, ...prev]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };

    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[s.container, { paddingTop: isWeb ? 83 : insets.top + 16, paddingBottom: isWeb ? 34 : insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        {required > 0 && (
          <KontraCard style={[s.alertCard, { borderLeftColor: colors.destructive }]} padding={14}>
            <View style={s.alertRow}><Feather name="alert-circle" size={18} color={colors.destructive} /><Text style={[s.alertText, { color: colors.foreground }]}>{required} document{required > 1 ? "s" : ""} required from servicer</Text></View>
          </KontraCard>
        )}
        <View style={s.uploadRow}>
          <TouchableOpacity style={[s.uploadBtn, { backgroundColor: colors.borrower }]} onPress={handleUpload} activeOpacity={0.85}><Feather name="upload" size={16} color="#fff" /><Text style={s.uploadBtnText}>Upload</Text></TouchableOpacity>
          <TouchableOpacity style={[s.uploadBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]} onPress={handleCamera} activeOpacity={0.85}><Feather name="camera" size={16} color={colors.foreground} /><Text style={[s.uploadBtnText, { color: colors.foreground }]}>Scan</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} onPress={() => setFilter(c)} style={[s.chip, { backgroundColor: filter === c ? colors.borrower : colors.secondary, borderColor: filter === c ? colors.borrower : colors.border }]} activeOpacity={0.8}>
              <Text style={[s.chipText, { color: filter === c ? "#fff" : colors.mutedForeground }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ gap: 10 }}>
          {filtered.map(doc => {
            const icon = CAT_ICONS[doc.category] ?? CAT_ICONS.default;
            const sc = STATUS_COLORS[doc.status];
            return (
              <KontraCard key={doc.id} padding={14}>
                <View style={s.docRow}>
                  <View style={[s.docIcon, { backgroundColor: colors.borrowerLight }]}><Feather name={icon} size={18} color={colors.borrower} /></View>
                  <View style={s.docBody}><Text style={[s.docName, { color: colors.foreground }]} numberOfLines={1}>{doc.name}</Text><Text style={[s.docMeta, { color: colors.mutedForeground }]}>{doc.loan} · {doc.category} · {doc.size}</Text><Text style={[s.docDate, { color: colors.mutedForeground }]}>{doc.date}</Text></View>
                  <View style={[s.statusPill, { backgroundColor: sc.bg }]}><Text style={[s.statusText, { color: sc.text }]}>{doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}</Text></View>
                </View>
              </KontraCard>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  const s = StyleSheet.create({
    container: { paddingHorizontal: 16 },
    alertCard: { marginBottom: 14, borderLeftWidth: 3 },
    alertRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    alertText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
    uploadRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    uploadBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10 },
    uploadBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    filterScroll: { marginBottom: 14 },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
    chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    docRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    docIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    docBody: { flex: 1, gap: 2 },
    docName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    docMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
    docDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  });
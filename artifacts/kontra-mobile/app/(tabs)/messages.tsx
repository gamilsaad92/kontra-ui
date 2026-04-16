import { Feather } from "@expo/vector-icons";
  import * as Haptics from "expo-haptics";
  import { KeyboardAvoidingView } from "react-native-keyboard-controller";
  import React, { useRef, useState } from "react";
  import { FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { useColors } from "@/hooks/useColors";

  interface Thread { id: string; subject: string; preview: string; date: string; unread: boolean; loan: string; }
  interface Message { id: string; from: string; body: string; time: string; isMe: boolean; }

  const THREADS: Thread[] = [
    { id: "T001", subject: "Payoff Quote Request", preview: "We've received your request and are processing...", date: "Apr 15", unread: true, loan: "L004" },
    { id: "T002", subject: "Maturity Extension Discussion", preview: "Please provide updated rent roll for review", date: "Apr 10", unread: false, loan: "L005" },
    { id: "T003", subject: "Insurance Documentation", preview: "Your certificate has been approved and filed.", date: "Mar 28", unread: false, loan: "L006" },
    { id: "T004", subject: "Draw Request Update", preview: "Phase 2 draw has been approved. Funds...", date: "Mar 15", unread: false, loan: "L006" },
  ];
  const THREAD_MESSAGES: Message[] = [
    { id: "m1", from: "Kontra Servicing", body: "Hello! We've received your payoff quote request for 200 Commerce Dr (L004). We're currently processing it and expect to have the quote ready within 2 business days.", time: "Apr 15, 10:32 AM", isMe: false },
    { id: "m2", from: "You", body: "Thank you. Can you also confirm the per diem interest rate that will be used?", time: "Apr 15, 11:05 AM", isMe: true },
    { id: "m3", from: "Kontra Servicing", body: "Of course. The per diem will be calculated at 6.10% / 365 × current outstanding principal. We'll include the full calculation in your payoff statement.", time: "Apr 15, 2:18 PM", isMe: false },
  ];

  export default function MessagesScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const isWeb = Platform.OS === "web";
    const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
    const [messages, setMessages] = useState<Message[]>(THREAD_MESSAGES);
    const [input, setInput] = useState("");
    const flatRef = useRef<FlatList>(null);

    const sendMessage = () => {
      if (!input.trim()) return;
      Haptics.selectionAsync();
      setMessages(prev => [...prev, { id: `m${Date.now()}`, from: "You", body: input.trim(), time: "Now", isMe: true }]);
      setInput("");
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    };

    if (selectedThread) {
      return (
        <KeyboardAvoidingView style={[s.flex, { backgroundColor: colors.background }]} behavior="padding" keyboardVerticalOffset={0}>
          <View style={[s.chatHeader, { borderBottomColor: colors.border, paddingTop: isWeb ? 67 : insets.top }]}>
            <TouchableOpacity onPress={() => setSelectedThread(null)} style={s.backBtn}><Feather name="arrow-left" size={22} color={colors.foreground} /></TouchableOpacity>
            <View style={s.chatHeaderBody}><Text style={[s.chatTitle, { color: colors.foreground }]} numberOfLines={1}>{selectedThread.subject}</Text><Text style={[s.chatSub, { color: colors.mutedForeground }]}>Loan {selectedThread.loan}</Text></View>
          </View>
          <FlatList ref={flatRef} data={messages} keyExtractor={m => m.id} contentContainerStyle={[s.msgList, { paddingBottom: isWeb ? 34 : insets.bottom + 16 }]} showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[s.msgRow, item.isMe && s.msgRowMe]}>
                {!item.isMe && <View style={[s.avatar, { backgroundColor: colors.borrowerLight }]}><Feather name="user" size={14} color={colors.borrower} /></View>}
                <View style={{ maxWidth: "78%" }}>
                  <View style={[s.bubble, item.isMe ? { backgroundColor: colors.borrower } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                    <Text style={[s.bubbleText, { color: item.isMe ? "#fff" : colors.foreground }]}>{item.body}</Text>
                  </View>
                  <Text style={[s.bubbleTime, { color: colors.mutedForeground, textAlign: item.isMe ? "right" : "left" }]}>{item.time}</Text>
                </View>
              </View>
            )}
          />
          <View style={[s.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: isWeb ? 34 : insets.bottom + 8 }]}>
            <TextInput style={[s.msgInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]} placeholder="Type a message..." placeholderTextColor={colors.mutedForeground} value={input} onChangeText={setInput} multiline returnKeyType="send" onSubmitEditing={sendMessage} />
            <TouchableOpacity style={[s.sendBtn, { backgroundColor: input.trim() ? colors.borrower : colors.secondary }]} onPress={sendMessage} disabled={!input.trim()} activeOpacity={0.85}>
              <Feather name="send" size={18} color={input.trim() ? "#fff" : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      );
    }

    return (
      <FlatList data={THREADS} keyExtractor={t => t.id} style={{ backgroundColor: colors.background }} contentContainerStyle={[s.listContainer, { paddingTop: isWeb ? 83 : insets.top + 16, paddingBottom: isWeb ? 34 : insets.bottom + 80 }]} ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => { setSelectedThread(item); Haptics.selectionAsync(); }} activeOpacity={0.8}>
            <View style={[s.threadCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {item.unread && <View style={[s.unreadDot, { backgroundColor: colors.borrower }]} />}
              <View style={s.threadBody}>
                <View style={s.threadTop}><Text style={[s.threadSubject, { color: colors.foreground, fontFamily: item.unread ? "Inter_600SemiBold" : "Inter_500Medium" }]} numberOfLines={1}>{item.subject}</Text><Text style={[s.threadDate, { color: colors.mutedForeground }]}>{item.date}</Text></View>
                <Text style={[s.threadLoan, { color: colors.borrower }]}>Loan {item.loan}</Text>
                <Text style={[s.threadPreview, { color: colors.mutedForeground }]} numberOfLines={1}>{item.preview}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        )}
      />
    );
  }

  const s = StyleSheet.create({
    flex: { flex: 1 },
    listContainer: { paddingHorizontal: 16 },
    threadCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, position: "relative" },
    unreadDot: { position: "absolute", top: 14, left: 14, width: 8, height: 8, borderRadius: 4 },
    threadBody: { flex: 1, marginLeft: 8, marginRight: 8 },
    threadTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
    threadSubject: { fontSize: 14, flex: 1, marginRight: 8 },
    threadDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
    threadLoan: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
    threadPreview: { fontSize: 12, fontFamily: "Inter_400Regular" },
    chatHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
    backBtn: { padding: 4 },
    chatHeaderBody: { flex: 1 },
    chatTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
    chatSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
    msgList: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
    msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    msgRowMe: { justifyContent: "flex-end" },
    avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    bubble: { padding: 12, borderRadius: 14 },
    bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3, paddingHorizontal: 4 },
    inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
    msgInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 120 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  });
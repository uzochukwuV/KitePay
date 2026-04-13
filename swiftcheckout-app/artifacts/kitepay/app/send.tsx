import { useWallet } from "../hooks/useWallet";
import { ethers } from "ethers";
import { KITE_RPC_URL, USDC_ADDRESS, ERC20_ABI } from "../constants/contracts";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const RECENT_CONTACTS = [
  { id: "1", name: "Chidi O.", initials: "CO", color: "#2563EB" },
  { id: "2", name: "Ada M.", initials: "AM", color: "#10B981" },
  { id: "3", name: "Emeka A.", initials: "EA", color: "#8B5CF6" },
  { id: "4", name: "Kemi B.", initials: "KB", color: "#F59E0B" },
];

export default function SendScreen() {
  const insets = useSafeAreaInsets();
  const { wallet, address } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [rate, setRate] = useState(1500);

  const nairaEquivalent = amount
    ? `₦${(parseFloat(amount) * rate).toLocaleString()}`
    : "₦0";

  const handleContinue = () => {
    if (!recipient || !amount || !address) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!wallet) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const provider = new ethers.JsonRpcProvider(KITE_RPC_URL);
      const signer = wallet.connect(provider);
      const contract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
      
      const amountToSend = ethers.parseUnits(amount, 6);
      const tx = await contract.transfer(recipient, amountToSend);
      await tx.wait();
      
      setStep("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error("Send failed", e);
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <View style={styles.successContainer}>
        <LinearGradient colors={["#F0FDF4", "#DCFCE7"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.successInner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.successIcon}>
            <Feather name="check" size={40} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Sent!</Text>
          <Text style={styles.successAmount}>${amount}</Text>
          <Text style={styles.successTo}>to {recipient}</Text>
          <Text style={styles.successNaira}>{nairaEquivalent}</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === "confirm") {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => setStep("form")} style={styles.closeBtn}>
            <Feather name="arrow-left" size={22} color="#0D1117" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Send</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.confirmCard}>
          <LinearGradient colors={["#0F172A", "#1E3A8A"]} style={styles.confirmGradient}>
            <Text style={styles.confirmLabel}>Sending to</Text>
            <Text style={styles.confirmRecipient}>{recipient}</Text>
            <Text style={styles.confirmAmount}>${amount}</Text>
            <Text style={styles.confirmNaira}>{nairaEquivalent}</Text>
            {note ? (
              <View style={styles.noteRow}>
                <Feather name="message-square" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.confirmNote}>{note}</Text>
              </View>
            ) : null}
          </LinearGradient>
        </View>

        <View style={styles.feesRow}>
          <Text style={styles.feeLabel}>Network fee</Text>
          <Text style={styles.feeValue}>$0.00 (Gasless)</Text>
        </View>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#2563EB", "#1E40AF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmBtnGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirm & Send</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#0D1117" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send USDC</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Recent Contacts */}
          <Text style={styles.sectionLabel}>Recent</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contacts}>
            {RECENT_CONTACTS.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.contactChip}
                onPress={() => setRecipient(c.name)}
              >
                <View style={[styles.contactAvatar, { backgroundColor: c.color + "20" }]}>
                  <Text style={[styles.contactInitials, { color: c.color }]}>{c.initials}</Text>
                </View>
                <Text style={styles.contactName}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>Recipient</Text>
          <View style={styles.inputWrapper}>
            <Feather name="user" size={18} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username, address, or phone"
              placeholderTextColor="#CBD5E1"
              value={recipient}
              onChangeText={setRecipient}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.sectionLabel}>Amount</Text>
          <View style={styles.amountWrapper}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#CBD5E1"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.currencyCode}>USDC</Text>
          </View>
          {amount ? (
            <Text style={styles.conversion}>≈ {nairaEquivalent}</Text>
          ) : null}

          <View style={styles.quickAmounts}>
            {["10", "25", "50", "100"].map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.quickBtn}
                onPress={() => setAmount(q)}
              >
                <Text style={styles.quickBtnText}>${q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Note (optional)</Text>
          <View style={styles.inputWrapper}>
            <Feather name="message-square" size={18} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="What's this for?"
              placeholderTextColor="#CBD5E1"
              value={note}
              onChangeText={setNote}
            />
          </View>

          <TouchableOpacity
            style={[styles.continueBtn, (!recipient || !amount) && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!recipient || !amount}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={
                recipient && amount ? ["#2563EB", "#1E40AF"] : ["#CBD5E1", "#CBD5E1"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueBtnGradient}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#0D1117",
  },
  form: { padding: 20, gap: 12 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    marginTop: 8,
  },
  contacts: { marginBottom: 4 },
  contactChip: { alignItems: "center", gap: 6, marginRight: 16 },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInitials: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  contactName: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
  },
  inputIcon: { marginLeft: 14 },
  input: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#0D1117",
  },
  amountWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    color: "#64748B",
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#0D1117",
  },
  currencyCode: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  conversion: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: -4,
  },
  quickAmounts: {
    flexDirection: "row",
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  quickBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#2563EB",
  },
  continueBtn: { borderRadius: 16, overflow: "hidden", marginTop: 12 },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    gap: 8,
  },
  continueBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  confirmCard: { margin: 20, borderRadius: 20, overflow: "hidden" },
  confirmGradient: { padding: 28, alignItems: "center", gap: 8 },
  confirmLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
  },
  confirmRecipient: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  confirmAmount: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -1,
    marginTop: 8,
  },
  confirmNaira: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  confirmNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  feesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  feeLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  feeValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#10B981",
  },
  confirmBtn: { marginHorizontal: 20, borderRadius: 16, overflow: "hidden" },
  confirmBtnGradient: {
    paddingVertical: 17,
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  successContainer: { flex: 1 },
  successInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#10B981",
  },
  successAmount: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#0D1117",
    letterSpacing: -1,
  },
  successTo: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  successNaira: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 16,
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

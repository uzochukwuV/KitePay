import { useWallet } from "../hooks/useWallet";
import { BACKEND_URL } from "../constants/contracts";
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

const RATE = 1500;

const BANKS = [
  { id: "gtb", name: "GTBank", code: "058" },
  { id: "access", name: "Access Bank", code: "044" },
  { id: "zenith", name: "Zenith Bank", code: "057" },
  { id: "uba", name: "UBA", code: "033" },
];

export default function OnrampScreen() {
  const insets = useSafeAreaInsets();
  const { address } = useWallet();
  const [ngnAmount, setNgnAmount] = useState("");
  const [selectedBank, setSelectedBank] = useState(BANKS[0]);
  const [step, setStep] = useState<"form" | "transfer" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [rate, setRate] = useState(1500);

  const usdcAmount = ngnAmount
    ? (parseFloat(ngnAmount.replace(/,/g, "")) / rate).toFixed(2)
    : "0.00";

  const fee = ngnAmount
    ? (parseFloat(ngnAmount.replace(/,/g, "")) * 0.005).toFixed(0)
    : "0";

  const handleContinue = async () => {
    if (!ngnAmount || !address) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // In a real app, use the actual backend URL from env
      const response = await fetch(`${BACKEND_URL}/api/onramp/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          kiteWallet: address,
          ngnAmount: parseFloat(ngnAmount.replace(/,/g, "")),
        }),
      });
      const data = await response.json();
      setOrderData(data);
      setStep("transfer");
    } catch (e) {
      console.error("Failed to initiate onramp", e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((r) => setTimeout(r, 2000));
    setLoading(false);
    setStep("success");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (step === "success") {
    return (
      <View style={styles.successContainer}>
        <LinearGradient colors={["#EFF6FF", "#DBEAFE"]} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.successInner,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40),
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40),
            },
          ]}
        >
          <View style={styles.successIcon}>
            <Feather name="check" size={40} color="#2563EB" />
          </View>
          <Text style={styles.successTitle}>USDC Incoming!</Text>
          <Text style={styles.successAmount}>${usdcAmount} USDC</Text>
          <Text style={styles.successSub}>
            ₦{parseInt(ngnAmount.replace(/,/g, "")).toLocaleString()} received
          </Text>
          <Text style={styles.successNote}>
            USDC will appear in your wallet within 2-5 minutes
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === "transfer") {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) },
          ]}
        >
          <TouchableOpacity onPress={() => setStep("form")} style={styles.closeBtn}>
            <Feather name="arrow-left" size={22} color="#0D1117" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Make Transfer</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.instructionsCard}>
            <LinearGradient
              colors={["#0F172A", "#1E3A8A"]}
              style={styles.instructionsGradient}
            >
              <Text style={styles.instLabel}>Transfer to this account</Text>
              <View style={styles.bankDetail}>
                <Text style={styles.bankDetailLabel}>Bank</Text>
                <Text style={styles.bankDetailValue}>{orderData?.instructions?.bankName || "Sandbox Bank"}</Text>
              </View>
              <View style={styles.bankDetail}>
                <Text style={styles.bankDetailLabel}>Account Number</Text>
                <Text style={styles.bankDetailValue}>{orderData?.instructions?.accountNumber || "0123456789"}</Text>
              </View>
              <View style={styles.bankDetail}>
                <Text style={styles.bankDetailLabel}>Account Name</Text>
                <Text style={styles.bankDetailValue}>{orderData?.instructions?.accountName || "SwiftCheckout Onramp"}</Text>
              </View>
              <View style={[styles.bankDetail, styles.bankDetailHighlight]}>
                <Text style={styles.bankDetailLabel}>Amount to Send</Text>
                <Text style={[styles.bankDetailValue, styles.bankDetailHighlightValue]}>
                  ₦{parseInt(ngnAmount.replace(/,/g, "")).toLocaleString()}
                </Text>
              </View>
              <Text style={styles.instNote}>
                Reference: {orderData?.instructions?.reference || "order-id"}
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.youWillReceive}>
            <Text style={styles.receiveLabel}>You will receive</Text>
            <Text style={styles.receiveAmount}>${orderData?.usdcEstimate || usdcAmount} USDC</Text>
            <Text style={styles.receiveSub}>at rate 1 USDC = ₦{rate}</Text>
          </View>

          <View style={styles.timer}>
            <Feather name="clock" size={16} color="#F59E0B" />
            <Text style={styles.timerText}>This order expires in 30 minutes</Text>
          </View>

          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#2563EB", "#1E40AF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.verifyGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.verifyText}>I've Made the Transfer</Text>
                  <Feather name="check-circle" size={18} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#0D1117" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Buy USDC</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Rate Banner */}
          <View style={styles.rateBanner}>
            <View style={styles.rateLeft}>
              <Feather name="zap" size={14} color="#2563EB" />
              <Text style={styles.rateText}>Live Rate</Text>
            </View>
            <Text style={styles.rateValue}>₦1,500 = $1 USDC</Text>
          </View>

          {/* NGN Input */}
          <Text style={styles.sectionLabel}>Amount in NGN</Text>
          <View style={styles.amountWrapper}>
            <Text style={styles.currencySymbol}>₦</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="#CBD5E1"
              value={ngnAmount}
              onChangeText={setNgnAmount}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.quickAmounts}>
            {["5,000", "10,000", "50,000", "100,000"].map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.quickBtn}
                onPress={() => setNgnAmount(q)}
              >
                <Text style={styles.quickBtnText}>₦{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* You Get */}
          <View style={styles.youGetCard}>
            <Text style={styles.youGetLabel}>You will receive</Text>
            <Text style={styles.youGetAmount}>${usdcAmount} USDC</Text>
            <Text style={styles.youGetFee}>Fee: ₦{parseInt(fee).toLocaleString()} (0.5%)</Text>
          </View>

          {/* Bank Selection */}
          <Text style={styles.sectionLabel}>Your Bank</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankList}>
            {BANKS.map((bank) => (
              <TouchableOpacity
                key={bank.id}
                style={[styles.bankChip, selectedBank.id === bank.id && styles.bankChipActive]}
                onPress={() => setSelectedBank(bank)}
              >
                <Text
                  style={[
                    styles.bankChipText,
                    selectedBank.id === bank.id && styles.bankChipTextActive,
                  ]}
                >
                  {bank.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.continueBtn, !ngnAmount && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!ngnAmount}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={ngnAmount ? ["#2563EB", "#1E40AF"] : ["#CBD5E1", "#CBD5E1"]}
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
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#0D1117" },
  content: { padding: 20, gap: 14 },
  rateBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rateLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  rateText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#2563EB" },
  rateValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E40AF" },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  amountWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  currencySymbol: { fontSize: 24, fontFamily: "Inter_600SemiBold", color: "#64748B", marginRight: 6 },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#0D1117",
  },
  quickAmounts: { flexDirection: "row", gap: 8 },
  quickBtn: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  quickBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#2563EB" },
  youGetCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  youGetLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B" },
  youGetAmount: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#1E40AF" },
  youGetFee: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  bankList: { marginBottom: 4 },
  bankChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginRight: 8,
    backgroundColor: "#FFFFFF",
  },
  bankChipActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  bankChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  bankChipTextActive: { color: "#2563EB" },
  continueBtn: { borderRadius: 16, overflow: "hidden", marginTop: 8 },
  continueBtnDisabled: { opacity: 0.5 },
  continueBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    gap: 8,
  },
  continueBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  instructionsCard: { borderRadius: 20, overflow: "hidden" },
  instructionsGradient: { padding: 24, gap: 12 },
  instLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 8,
  },
  bankDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  bankDetailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },
  bankDetailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  bankDetailHighlight: {
    borderBottomWidth: 0,
    paddingTop: 12,
  },
  bankDetailHighlightValue: { fontSize: 18, color: "#60A5FA" },
  instNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
  },
  youWillReceive: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  receiveLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B" },
  receiveAmount: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#1E40AF" },
  receiveSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 12,
  },
  timerText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#D97706" },
  verifyBtn: { borderRadius: 16, overflow: "hidden" },
  verifyGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    gap: 8,
  },
  verifyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
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
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#1E40AF" },
  successAmount: { fontSize: 42, fontFamily: "Inter_700Bold", color: "#0D1117", letterSpacing: -1 },
  successSub: { fontSize: 15, fontFamily: "Inter_400Regular", color: "#64748B" },
  successNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    marginTop: 8,
  },
  doneBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
  },
  doneBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
});

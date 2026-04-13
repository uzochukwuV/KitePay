import { useWallet } from "../hooks/useWallet";
import { ethers } from "ethers";
import { KITE_RPC_URL, USDC_ADDRESS, VAULT_ADDRESS, ERC20_ABI, VAULT_ABI, BACKEND_URL } from "../constants/contracts";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
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

export default function OfframpScreen() {
  const insets = useSafeAreaInsets();
  const { wallet, address } = useWallet();
  const [usdcAmount, setUsdcAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("OPAY");
  const [accountName, setAccountName] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [rate, setRate] = useState(1500);
  const [usdcBalance, setUsdcBalance] = useState("0.00");

  useEffect(() => {
    if (address) {
      const fetchBalance = async () => {
        try {
          const provider = new ethers.JsonRpcProvider(KITE_RPC_URL);
          const contract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
          const balance = await contract.balanceOf(address);
          setUsdcBalance(parseFloat(ethers.formatUnits(balance, 6)).toLocaleString(undefined, { minimumFractionDigits: 2 }));
        } catch (e) {
          console.error(e);
        }
      };
      fetchBalance();
    }
  }, [address]);

  const ngnAmount = usdcAmount
    ? (parseFloat(usdcAmount) * rate).toLocaleString()
    : "0";

  const handleContinue = async () => {
    if (!usdcAmount || !accountNumber || !address) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const response = await fetch(`${BACKEND_URL}/api/offramp/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          usdcAmount: parseFloat(usdcAmount),
          bankAccountNumber: accountNumber,
          bankName: bankName,
          accountName: accountName || "User Account",
        }),
      });
      const data = await response.json();
      setOrderData(data);
      setStep("confirm");
    } catch (e) {
      console.error("Failed to initiate offramp", e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!wallet || !orderData) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      // EIP-3009 Gasless Offramp
      console.log("Generating EIP-3009 signature...");
      
      const orderIdBytes32 = ethers.id(orderData.orderId);
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      
      const domain = {
        name: "USD Coin",
        version: "2",
        chainId: 2368,
        verifyingContract: USDC_ADDRESS
      };

      const types = {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };

      const value = ethers.parseUnits(usdcAmount, 6);

      const message = {
        from: wallet.address,
        to: VAULT_ADDRESS,
        value: value,
        validAfter: validAfter,
        validBefore: validBefore,
        nonce: nonce,
      };

      const signature = await wallet.signTypedData(domain, types, message);
      
      console.log("Submitting to Gasless Relayer...");
      
      // Submit to Kite Gasless Relayer as per guide
      const relayResponse = await fetch('https://gasless.gokite.ai/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: VAULT_ADDRESS,
          data: {
            orderId: orderIdBytes32,
            value: value.toString(),
            signature: signature,
            from: wallet.address
          }
        })
      });

      if (!relayResponse.ok) {
        throw new Error("Relay failed");
      }
      
      setStep("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error("Gasless offramp failed", e);
      // Fallback to direct transaction if relayer fails (optional)
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <View style={styles.successContainer}>
        <LinearGradient colors={["#FFFBEB", "#FEF3C7"]} style={StyleSheet.absoluteFill} />
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
            <Feather name="check" size={40} color="#D97706" />
          </View>
          <Text style={styles.successTitle}>Withdrawal Initiated!</Text>
          <Text style={styles.successAmount}>₦{ngnAmount}</Text>
          <Text style={styles.successSub}>to account •••• {accountNumber.slice(-4)}</Text>
          <Text style={styles.successNote}>
            Funds will arrive in your bank account within 2-5 minutes
          </Text>
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
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) },
          ]}
        >
          <TouchableOpacity onPress={() => setStep("form")} style={styles.closeBtn}>
            <Feather name="arrow-left" size={22} color="#0D1117" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Withdrawal</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={["#0F172A", "#1E3A8A"]}
            style={styles.confirmCard}
          >
            <Text style={styles.confirmLabel}>You will receive</Text>
            <Text style={styles.confirmAmount}>₦{ngnAmount}</Text>
            <Text style={styles.confirmSub}>
              Sending ${usdcAmount} USDC to NGN
            </Text>
            <View style={styles.confirmDetail}>
              <Text style={styles.confirmDetailLabel}>To Account</Text>
              <Text style={styles.confirmDetailValue}>•••• {accountNumber.slice(-4)}</Text>
            </View>
            <View style={styles.confirmDetail}>
              <Text style={styles.confirmDetailLabel}>Fee</Text>
              <Text style={styles.confirmDetailValue}>${(parseFloat(usdcAmount) * 0.005).toFixed(2)} USDC (0.5%)</Text>
            </View>
            <View style={styles.confirmDetail}>
              <Text style={styles.confirmDetailLabel}>Network</Text>
              <Text style={styles.confirmDetailValue}>Kite Chain (Gasless)</Text>
            </View>
          </LinearGradient>

          <View style={styles.notice}>
            <Feather name="info" size={14} color="#2563EB" />
            <Text style={styles.noticeText}>
              USDC will be deducted from your wallet immediately. NGN arrives
              in your bank account within 2-5 minutes.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#F59E0B", "#D97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmBtnGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Withdrawal</Text>
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
          <Text style={styles.headerTitle}>Sell USDC</Text>
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
          {/* Balance */}
          <View style={styles.balanceChip}>
            <Text style={styles.balanceLabel}>Available:</Text>
            <Text style={styles.balanceValue}>${usdcBalance} USDC</Text>
          </View>

          {/* Rate Banner */}
          <View style={styles.rateBanner}>
            <View style={styles.rateLeft}>
              <Feather name="zap" size={14} color="#F59E0B" />
              <Text style={[styles.rateText, { color: "#D97706" }]}>Live Rate</Text>
            </View>
            <Text style={[styles.rateValue, { color: "#92400E" }]}>$1 USDC = ₦1,500</Text>
          </View>

          <Text style={styles.sectionLabel}>USDC Amount to Sell</Text>
          <View style={styles.amountWrapper}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#CBD5E1"
              value={usdcAmount}
              onChangeText={setUsdcAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.currencyCode}>USDC</Text>
          </View>

          {usdcAmount ? (
            <View style={styles.youGetCard}>
              <Text style={styles.youGetLabel}>You will receive</Text>
              <Text style={[styles.youGetAmount, { color: "#D97706" }]}>₦{ngnAmount}</Text>
              <Text style={styles.youGetFee}>Fee: ${(parseFloat(usdcAmount) * 0.005).toFixed(2)} USDC (0.5%)</Text>
            </View>
          ) : null}

          <View style={styles.quickAmounts}>
            {["50", "100", "250", "500"].map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.quickBtn}
                onPress={() => setUsdcAmount(q)}
              >
                <Text style={styles.quickBtnText}>${q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Bank Account Number</Text>
          <View style={styles.inputWrapper}>
            <Feather name="credit-card" size={18} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="10-digit account number"
              placeholderTextColor="#CBD5E1"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.continueBtn,
              (!usdcAmount || !accountNumber) && styles.continueBtnDisabled,
            ]}
            onPress={handleContinue}
            disabled={!usdcAmount || !accountNumber}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={
                usdcAmount && accountNumber
                  ? ["#F59E0B", "#D97706"]
                  : ["#CBD5E1", "#CBD5E1"]
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
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#0D1117" },
  content: { padding: 20, gap: 14 },
  balanceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  balanceLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B" },
  balanceValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E40AF" },
  rateBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rateLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  rateText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  rateValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
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
  currencyCode: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  youGetCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  youGetLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B" },
  youGetAmount: { fontSize: 28, fontFamily: "Inter_700Bold" },
  youGetFee: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  quickAmounts: { flexDirection: "row", gap: 8 },
  quickBtn: {
    flex: 1,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  quickBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#D97706" },
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
  confirmCard: { borderRadius: 20, padding: 24, gap: 12 },
  confirmLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },
  confirmAmount: { fontSize: 38, fontFamily: "Inter_700Bold", color: "#FFFFFF", letterSpacing: -0.5 },
  confirmSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginBottom: 8 },
  confirmDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  confirmDetailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)" },
  confirmDetailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  notice: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
  },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#1E40AF", lineHeight: 18 },
  confirmBtn: { borderRadius: 16, overflow: "hidden" },
  confirmBtnGradient: { paddingVertical: 17, alignItems: "center" },
  confirmBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
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
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#D97706" },
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
    backgroundColor: "#F59E0B",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 16,
  },
  doneBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
});

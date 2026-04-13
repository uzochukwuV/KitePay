import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import QRCode from "react-native-qrcode-svg";
import { useWallet } from "../hooks/useWallet";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { wallet, address } = useWallet();
  const { merchantKiteWallet, ngnAmount } = useLocalSearchParams<{ merchantKiteWallet: string, ngnAmount: string }>();
  
  const [step, setStep] = useState<"loading" | "qr" | "success">("loading");
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const qrValue = orderData ? JSON.stringify({
    merchantId: merchantKiteWallet,
    orderId: orderData.orderId,
    usdcAmount: orderData.usdcEstimate
  }) : "";

  useEffect(() => {
    if (merchantKiteWallet && ngnAmount) {
      initiateCheckout();
    }
  }, [merchantKiteWallet, ngnAmount]);

  const initiateCheckout = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/checkout/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantKiteWallet,
          ngnAmount: parseFloat(ngnAmount),
        }),
      });
      const data = await response.json();
      setOrderData(data);
      setStep("qr");
    } catch (e) {
      console.error("Failed to initiate checkout", e);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // In a real app, you'd poll the backend for order status
    await new Promise((r) => setTimeout(r, 2000));
    setLoading(false);
    setStep("success");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (step === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Initializing Payment...</Text>
      </View>
    );
  }

  if (step === "success") {
    return (
      <View style={styles.successContainer}>
        <LinearGradient colors={["#F0FDF4", "#DCFCE7"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.successInner, { paddingTop: insets.top + 40 }]}>
          <View style={styles.successIcon}>
            <Feather name="check" size={40} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Payment Complete!</Text>
          <Text style={styles.successAmount}>₦{parseFloat(ngnAmount || "0").toLocaleString()}</Text>
          <Text style={styles.successSub}>Paid to {orderData?.instructions?.accountName || "Merchant"}</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.doneBtnText}>Return Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === "qr") {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="arrow-left" size={22} color="#0D1117" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Merchant Checkout</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Payment Request</Text>
            <Text style={styles.summaryAmount}>₦{parseFloat(ngnAmount || "0").toLocaleString()}</Text>
            <Text style={styles.summarySub}>≈ ${orderData?.usdcEstimate} USDC</Text>
          </View>

          <View style={styles.qrCard}>
            <Text style={styles.qrLabel}>Scan to Pay</Text>
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrValue}
                size={220}
                color="#0D1117"
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={styles.qrSub}>This QR code contains the payment details for this order.</Text>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR PAY VIA BANK TRANSFER</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.instructionsCard}>
            <LinearGradient colors={["#0F172A", "#1E3A8A"]} style={styles.instructionsGradient}>
              <Text style={styles.instLabel}>Transfer NGN to this account</Text>
              
              <View style={styles.bankDetail}>
                <Text style={styles.bankDetailLabel}>Bank Name</Text>
                <Text style={styles.bankDetailValue}>{orderData?.instructions?.bankName}</Text>
              </View>

              <View style={styles.bankDetail}>
                <Text style={styles.bankDetailLabel}>Account Number</Text>
                <Text style={styles.bankDetailValue}>{orderData?.instructions?.accountNumber}</Text>
              </View>

              <View style={styles.bankDetail}>
                <Text style={styles.bankDetailLabel}>Account Name</Text>
                <Text style={styles.bankDetailValue}>{orderData?.instructions?.accountName}</Text>
              </View>

              <View style={[styles.bankDetail, styles.bankDetailHighlight]}>
                <Text style={styles.bankDetailLabel}>Reference</Text>
                <Text style={[styles.bankDetailValue, { color: "#60A5FA" }]}>{orderData?.instructions?.reference}</Text>
              </View>
            </LinearGradient>
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
                <Text style={styles.verifyText}>Check Payment Status</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 16, fontFamily: "Inter_500Medium", color: "#64748B" },
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
  content: { padding: 20, gap: 20 },
  summaryCard: {
    backgroundColor: "#F8FAFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  summaryAmount: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#0D1117" },
  summarySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  qrCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  qrLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#0D1117",
    marginBottom: 20,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: "#F8FAFF",
    borderRadius: 16,
    marginBottom: 16,
  },
  qrSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  dividerText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  instructionsCard: { borderRadius: 20, overflow: "hidden" },
  instructionsGradient: { padding: 24, gap: 12 },
  instLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)", marginBottom: 8 },
  bankDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  bankDetailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },
  bankDetailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  bankDetailHighlight: { borderBottomWidth: 0, paddingTop: 12 },
  notice: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
  },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#1E40AF", lineHeight: 18 },
  verifyBtn: { borderRadius: 16, overflow: "hidden" },
  verifyGradient: { paddingVertical: 17, alignItems: "center" },
  verifyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  successContainer: { flex: 1 },
  successInner: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  successIcon: { width: 88, height: 88, borderRadius: 28, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  successTitle: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#10B981" },
  successAmount: { fontSize: 48, fontFamily: "Inter_700Bold", color: "#0D1117", letterSpacing: -1 },
  successSub: { fontSize: 16, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginBottom: 32 },
  doneBtn: { backgroundColor: "#10B981", paddingHorizontal: 48, paddingVertical: 16, borderRadius: 16 },
  doneBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
});

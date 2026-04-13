import QRCode from "react-native-qrcode-svg";
import { useWallet } from "../hooks/useWallet";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MOCK_ADDRESS = "0x4A3b...9F2e";
const MOCK_USERNAME = "@johndoe.kite";

export default function ReceiveScreen() {
  const insets = useSafeAreaInsets();
  const { address } = useWallet();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"address" | "username">("address");

  const handleCopy = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color="#0D1117" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receive USDC</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Share your address or QR code to receive USDC</Text>

        {/* Tab Toggle */}
        <View style={styles.tabRow}>
          {(["username", "address"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === "username" ? "Username" : "Wallet Address"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* QR Code Placeholder */}
        <LinearGradient
          colors={["#EFF6FF", "#DBEAFE"]}
          style={styles.qrContainer}
        >
          <View style={styles.qrInner}>
            <View style={styles.qrWhiteBg}>
              <QRCode
                value={activeTab === "username" ? "@user.kite" : address || "0x..."}
                size={180}
                color="#0D1117"
                backgroundColor="#FFFFFF"
              />
            </View>
            <View style={styles.qrLogoOverlay}>
              <Text style={styles.qrLogoText}>K</Text>
            </View>
          </View>
          <Text style={styles.qrLabel}>Scan with any Kite Chain wallet</Text>
        </LinearGradient>

        {/* Address/Username */}
        <View style={styles.addressBox}>
          <Text style={styles.addressLabel}>
            {activeTab === "username" ? "Your Username" : "Wallet Address"}
          </Text>
          <View style={styles.addressRow}>
            <Text style={styles.addressText} numberOfLines={1}>
              {activeTab === "username" ? "@user.kite" : address || "0x..."}
            </Text>
            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
              onPress={handleCopy}
            >
              <Feather
                name={copied ? "check" : "copy"}
                size={16}
                color={copied ? "#10B981" : "#2563EB"}
              />
              <Text style={[styles.copyText, copied && styles.copyTextSuccess]}>
                {copied ? "Copied!" : "Copy"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Network Info */}
        <View style={styles.networkInfo}>
          <Feather name="info" size={14} color="#64748B" />
          <Text style={styles.networkText}>
            Only send <Text style={styles.bold}>USDC</Text> on the{" "}
            <Text style={styles.bold}>Kite Chain</Text> network. Sending other
            tokens or using different networks may result in permanent loss.
          </Text>
        </View>

        {/* Share Button */}
        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85}>
          <LinearGradient
            colors={["#2563EB", "#1E40AF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shareBtnGradient}
          >
            <Feather name="share-2" size={18} color="#fff" />
            <Text style={styles.shareBtnText}>Share Address</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
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
  content: { padding: 20, gap: 20 },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
  },
  tabTextActive: { color: "#1E40AF", fontFamily: "Inter_600SemiBold" },
  qrContainer: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  qrInner: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  qrWhiteBg: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  qrLogoOverlay: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1E40AF",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  qrLogoText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  qrLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  addressBox: {
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  addressLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#0D1117",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyBtnSuccess: { backgroundColor: "#D1FAE5" },
  copyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#2563EB",
  },
  copyTextSuccess: { color: "#10B981" },
  networkInfo: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  networkText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#92400E",
    lineHeight: 18,
  },
  bold: { fontFamily: "Inter_600SemiBold" },
  shareBtn: { borderRadius: 16, overflow: "hidden" },
  shareBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    gap: 10,
  },
  shareBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

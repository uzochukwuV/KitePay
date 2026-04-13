import { useWallet } from "../../hooks/useWallet";
import { ethers } from "ethers";
import { KITE_RPC_URL, USDC_ADDRESS, ERC20_ABI } from "../../constants/contracts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACCENT = "#C8FF00";
const ACCENT_FG = "#000000";

const MOCK_TRANSACTIONS = [
  { id: "1", type: "received", label: "Received USDC", amount: "+$45.00", naira: "+₦67,500", date: "Today, 2:30 PM", icon: "arrow-down-left", color: "#00D4A0" },
  { id: "2", type: "sent", label: "Sent to Chidi", amount: "-$12.00", naira: "-₦18,000", date: "Today, 10:15 AM", icon: "arrow-up-right", color: "#FF4444" },
  { id: "3", type: "onramp", label: "NGN Converted", amount: "+$100.00", naira: "+₦150,000", date: "Yesterday", icon: "repeat", color: "#3B82F6" },
  { id: "4", type: "yield", label: "Yield Earned", amount: "+$0.48", naira: "+₦720", date: "Yesterday", icon: "trending-up", color: "#A855F7" },
];

const QUICK_ACTIONS = [
  { id: "send", label: "Send", icon: "send", route: "/send", color: ACCENT, bg: "rgba(200,255,0,0.12)" },
  { id: "receive", label: "Receive", icon: "download", route: "/receive", color: "#00D4A0", bg: "rgba(0,212,160,0.12)" },
  { id: "onramp", label: "Buy USDC", icon: "plus-circle", route: "/onramp", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  { id: "offramp", label: "Sell", icon: "minus-circle", route: "/offramp", color: "#FFB800", bg: "rgba(255,184,0,0.12)" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { address } = useWallet();
  const [userName, setUserName] = useState("User");
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [usdcBalance, setUsdcBalance] = useState("0.00");
  const [nairaBalance, setNairaBalance] = useState("0");
  const [rate] = useState(1500);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    try {
      const provider = new ethers.JsonRpcProvider(KITE_RPC_URL);
      const contract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
      const balance = await contract.balanceOf(address);
      const formatted = ethers.formatUnits(balance, 6);
      setUsdcBalance(
        parseFloat(formatted).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
      setNairaBalance(
        (parseFloat(formatted) * rate).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })
      );
    } catch (e) {
      console.error("Failed to fetch balance", e);
    } finally {
      setLoading(false);
    }
  }, [address, rate]);

  useEffect(() => {
    AsyncStorage.getItem("userName").then((name) => {
      if (name) setUserName(name.split(" ")[0]);
    });
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    if (address) {
      fetchBalance();
      const interval = setInterval(fetchBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [address, fetchBalance]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
          },
        ]}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.headerSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Top row */}
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Good morning,</Text>
              <Text style={styles.userName}>
                {userName} <Text style={styles.wave}>👋</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.notifBtn}
              accessibilityLabel="Notifications"
            >
              <Feather name="bell" size={20} color="rgba(255,255,255,0.7)" />
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>

          {/* Balance card */}
          <View style={styles.balanceCard}>
            {/* Label row */}
            <View style={styles.balanceLabelRow}>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <TouchableOpacity
                onPress={() => {
                  setBalanceVisible(!balanceVisible);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.eyeBtn}
                accessibilityLabel={balanceVisible ? "Hide balance" : "Show balance"}
              >
                <Feather
                  name={balanceVisible ? "eye" : "eye-off"}
                  size={16}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.balanceAmount}>
              {balanceVisible ? `$${usdcBalance}` : "••••••"}
            </Text>
            <Text style={styles.balanceNaira}>
              {balanceVisible ? `≈ ₦${nairaBalance}` : "••••••"}
            </Text>

            {/* Bottom row */}
            <View style={styles.balanceFooter}>
              <View style={styles.yieldBadge}>
                <Feather name="trending-up" size={11} color={ACCENT} />
                <Text style={styles.yieldText}>+$2.14 yield today</Text>
              </View>
              <Text style={styles.rateText}>1 USDC ≈ ₦{rate}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Quick Actions ───────────────────────────────────────────────── */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push(action.route as any);
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: action.bg }]}>
                  <Feather name={action.icon as any} size={20} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* ── Exchange Rate Banner ────────────────────────────────────────── */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.rateBanner}>
            <View>
              <Text style={styles.rateBannerLabel}>Live Exchange Rate</Text>
              <Text style={styles.rateBannerValue}>
                $1 USDC = ₦{rate}
              </Text>
              <Text style={styles.rateBannerSub}>Updated 2 min ago</Text>
            </View>
            <View style={styles.refreshIconWrap}>
              <Feather name="refresh-cw" size={16} color={ACCENT} />
            </View>
          </View>
        </Animated.View>

        {/* ── Recent Activity ─────────────────────────────────────────────── */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push("/transactions")}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.txList}>
            {MOCK_TRANSACTIONS.map((tx, index) => (
              <TouchableOpacity
                key={tx.id}
                style={[
                  styles.txRow,
                  index < MOCK_TRANSACTIONS.length - 1 && styles.txRowBorder,
                ]}
                activeOpacity={0.65}
              >
                <View style={[styles.txIcon, { backgroundColor: tx.color + "18" }]}>
                  <Feather name={tx.icon as any} size={17} color={tx.color} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txLabel}>{tx.label}</Text>
                  <Text style={styles.txDate}>{tx.date}</Text>
                </View>
                <View style={styles.txAmounts}>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: tx.type === "sent" ? "#FF4444" : "#00D4A0" },
                    ]}
                  >
                    {tx.amount}
                  </Text>
                  <Text style={styles.txNaira}>{tx.naira}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  scroll: { flexGrow: 1 },

  // ── Header section ──────────────────────────────────────────────────────────
  headerSection: {
    backgroundColor: "#111111",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 20,
    gap: 20,
    marginBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  userName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  wave: { fontSize: 20 },
  notifBtn: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FF4444",
    borderWidth: 1.5,
    borderColor: "#111111",
  },

  // ── Balance card ─────────────────────────────────────────────────────────────
  balanceCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  balanceLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  balanceLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  eyeBtn: { padding: 4 },
  balanceAmount: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  balanceNaira: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 14,
  },
  balanceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  yieldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200,255,0,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  yieldText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ACCENT,
  },
  rateText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
  },

  // ── Sections ─────────────────────────────────────────────────────────────────
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    marginBottom: 14,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: ACCENT,
    marginBottom: 14,
  },

  // ── Quick actions ────────────────────────────────────────────────────────────
  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  actionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)",
  },

  // ── Rate banner ──────────────────────────────────────────────────────────────
  rateBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  rateBannerLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    marginBottom: 3,
  },
  rateBannerValue: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  rateBannerSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    marginTop: 2,
  },
  refreshIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(200,255,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Transactions ─────────────────────────────────────────────────────────────
  txList: {
    backgroundColor: "#111111",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: { flex: 1 },
  txLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
  },
  txAmounts: { alignItems: "flex-end" },
  txAmount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  txNaira: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
  },
});

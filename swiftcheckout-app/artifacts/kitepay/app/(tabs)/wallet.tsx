import { useWallet } from "../../hooks/useWallet";
import { ethers } from "ethers";
import { KITE_RPC_URL, USDC_ADDRESS, ERC20_ABI } from "../../constants/contracts";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import {
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

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { address } = useWallet();
  const [activeTab, setActiveTab] = useState<"assets" | "cards">("assets");
  const [usdcBalance, setUsdcBalance] = useState("0.00");
  const [rate] = useState(1500);

  useEffect(() => {
    if (address) {
      const fetchBalance = async () => {
        try {
          const provider = new ethers.JsonRpcProvider(KITE_RPC_URL);
          const contract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
          const balance = await contract.balanceOf(address);
          setUsdcBalance(
            parseFloat(ethers.formatUnits(balance, 6)).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })
          );
        } catch (e) {
          console.error(e);
        }
      };
      fetchBalance();
      const interval = setInterval(fetchBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [address]);

  const nairaVal = (parseFloat(usdcBalance.replace(/,/g, "")) * rate).toLocaleString(
    undefined,
    { maximumFractionDigits: 0 }
  );

  const assets = [
    {
      id: "usdc",
      name: "USDC",
      fullName: "USD Coin",
      balance: usdcBalance,
      usd: `$${usdcBalance}`,
      naira: `₦${(parseFloat(usdcBalance.replace(/,/g, "")) * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      change: "+0.00%",
      positive: true,
      color: ACCENT,
      bg: "rgba(200,255,0,0.1)",
      icon: "dollar-sign",
    },
    {
      id: "eth",
      name: "ETH",
      fullName: "Ethereum",
      balance: "0.00",
      usd: "$0.00",
      naira: "₦0",
      change: "+0.0%",
      positive: true,
      color: "#A855F7",
      bg: "rgba(168,85,247,0.1)",
      icon: "layers",
    },
    {
      id: "lusdc",
      name: "L-USDC",
      fullName: "Lucid USDC (Yield)",
      balance: "0.00",
      usd: "$0.00",
      naira: "₦0",
      change: "+0.00%",
      positive: true,
      color: "#00D4A0",
      bg: "rgba(0,212,160,0.1)",
      icon: "trending-up",
    },
  ];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) },
        ]}
      >
        <Text style={styles.title}>Wallet</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
          },
        ]}
      >
        {/* ── Portfolio Card ──────────────────────────────────────────────── */}
        <View style={styles.portfolioCard}>
          <Text style={styles.portfolioLabel}>Portfolio Value</Text>
          <Text style={styles.portfolioValue}>${usdcBalance}</Text>
          <Text style={styles.portfolioNaira}>≈ ₦{nairaVal}</Text>

          <View style={styles.portfolioStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>24h Change</Text>
              <Text style={[styles.statValue, { color: "#00D4A0" }]}>+$0.00</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Yield Earned</Text>
              <Text style={[styles.statValue, { color: "#A855F7" }]}>$0.00</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>APY</Text>
              <Text style={[styles.statValue, { color: ACCENT }]}>4.8%</Text>
            </View>
          </View>
        </View>

        {/* ── Action Buttons ──────────────────────────────────────────────── */}
        <View style={styles.actions}>
          {[
            { label: "Add Money", icon: "plus", route: "/onramp", color: ACCENT, bg: "rgba(200,255,0,0.12)" },
            { label: "Withdraw", icon: "minus", route: "/offramp", color: "#00D4A0", bg: "rgba(0,212,160,0.12)" },
            { label: "Send", icon: "send", route: "/send", color: "#A855F7", bg: "rgba(168,85,247,0.12)" },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionBtn}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.actionBtnIcon, { backgroundColor: a.bg }]}>
                <Feather name={a.icon as any} size={18} color={a.color} />
              </View>
              <Text style={styles.actionBtnLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <View style={styles.tabRow}>
          {(["assets", "cards"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab === "assets" ? "Assets" : "Cards"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Asset List / Cards ──────────────────────────────────────────── */}
        {activeTab === "assets" ? (
          <View style={styles.assetsList}>
            {assets.map((asset, index) => (
              <TouchableOpacity
                key={asset.id}
                style={[
                  styles.assetRow,
                  index < assets.length - 1 && styles.assetRowBorder,
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.assetIcon, { backgroundColor: asset.bg }]}>
                  <Feather name={asset.icon as any} size={20} color={asset.color} />
                </View>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <Text style={styles.assetFull}>{asset.fullName}</Text>
                </View>
                <View style={styles.assetValues}>
                  <Text style={styles.assetUSD}>{asset.usd}</Text>
                  <Text style={[styles.assetChange, { color: "#00D4A0" }]}>
                    {asset.change}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.cardsSection}>
            <View style={styles.virtualCard}>
              <View style={styles.cardChip}>
                <Feather name="cpu" size={14} color="#C8FF00" />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>KitePay Virtual Card</Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                </View>
              </View>
              <Text style={styles.cardNum}>•••• •••• •••• ••••</Text>
            </View>
            <Text style={styles.cardHint}>
              Virtual debit card — spend USDC anywhere
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  header: { marginBottom: 20, paddingHorizontal: 20 },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },

  // ── Portfolio card ────────────────────────────────────────────────────────────
  portfolioCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  portfolioLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 2,
  },
  portfolioValue: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  portfolioNaira: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 14,
  },
  portfolioStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statItem: { flex: 1, alignItems: "center" },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    marginBottom: 5,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 2,
  },

  // ── Actions ───────────────────────────────────────────────────────────────────
  actions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  actionBtnIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#111111",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.35)",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },

  // ── Assets list ───────────────────────────────────────────────────────────────
  assetsList: {
    backgroundColor: "#111111",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  assetRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  assetIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  assetInfo: { flex: 1 },
  assetName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  assetFull: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
  },
  assetValues: { alignItems: "flex-end" },
  assetUSD: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  assetChange: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  // ── Cards section ─────────────────────────────────────────────────────────────
  cardsSection: { gap: 14 },
  virtualCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 22,
    height: 185,
    borderWidth: 1,
    borderColor: "rgba(200,255,0,0.15)",
    justifyContent: "space-between",
  },
  cardChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(200,255,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  comingSoonBadge: {
    backgroundColor: "rgba(200,255,0,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(200,255,0,0.2)",
  },
  comingSoonText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ACCENT,
  },
  cardNum: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 4,
  },
  cardHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
  },
});

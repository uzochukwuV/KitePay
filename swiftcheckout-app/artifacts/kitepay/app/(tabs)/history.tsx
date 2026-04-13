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

const ACCENT = "#C8FF00";
const ACCENT_FG = "#000000";

const ALL_TRANSACTIONS = [
  { id: "1", type: "received", label: "Received from Ada", amount: "+$45.00", naira: "+₦67,500", date: "Apr 12, 2026 · 2:30 PM", icon: "arrow-down-left", color: "#00D4A0", status: "completed" },
  { id: "2", type: "sent", label: "Sent to Chidi", amount: "-$12.00", naira: "-₦18,000", date: "Apr 12, 2026 · 10:15 AM", icon: "arrow-up-right", color: "#FF4444", status: "completed" },
  { id: "3", type: "onramp", label: "NGN → USDC", amount: "+$100.00", naira: "+₦150,000", date: "Apr 11, 2026 · 4:20 PM", icon: "repeat", color: "#3B82F6", status: "completed" },
  { id: "4", type: "yield", label: "Yield Earned", amount: "+$0.48", naira: "+₦720", date: "Apr 11, 2026 · 12:00 AM", icon: "trending-up", color: "#A855F7", status: "completed" },
  { id: "5", type: "offramp", label: "USDC → NGN", amount: "-$50.00", naira: "-₦75,000", date: "Apr 10, 2026 · 3:45 PM", icon: "repeat", color: "#FFB800", status: "completed" },
  { id: "6", type: "sent", label: "Sent to Emeka", amount: "-$8.50", naira: "-₦12,750", date: "Apr 10, 2026 · 11:00 AM", icon: "arrow-up-right", color: "#FF4444", status: "completed" },
  { id: "7", type: "received", label: "Received from Kemi", amount: "+$200.00", naira: "+₦300,000", date: "Apr 9, 2026 · 6:00 PM", icon: "arrow-down-left", color: "#00D4A0", status: "completed" },
  { id: "8", type: "yield", label: "Yield Earned", amount: "+$0.46", naira: "+₦690", date: "Apr 9, 2026 · 12:00 AM", icon: "trending-up", color: "#A855F7", status: "completed" },
];

const FILTERS = ["All", "Sent", "Received", "Onramp", "Offramp", "Yield"];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = ALL_TRANSACTIONS.filter((tx) => {
    if (activeFilter === "All") return true;
    return tx.type === activeFilter.toLowerCase();
  });

  const totalIn = ALL_TRANSACTIONS.filter((tx) =>
    ["received", "onramp", "yield"].includes(tx.type)
  ).reduce((sum, tx) => sum + parseFloat(tx.amount.replace(/[^0-9.]/g, "")), 0);

  const totalOut = ALL_TRANSACTIONS.filter((tx) =>
    ["sent", "offramp"].includes(tx.type)
  ).reduce((sum, tx) => sum + parseFloat(tx.amount.replace(/[^0-9.]/g, "")), 0);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) },
        ]}
      >
        <Text style={styles.title}>History</Text>
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
        {/* ── Summary ─────────────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: "rgba(0,212,160,0.12)" }]}>
              <Feather name="arrow-down-left" size={14} color="#00D4A0" />
            </View>
            <Text style={styles.summaryLabel}>Money In</Text>
            <Text style={[styles.summaryAmount, { color: "#00D4A0" }]}>
              +${totalIn.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: "rgba(255,68,68,0.12)" }]}>
              <Feather name="arrow-up-right" size={14} color="#FF4444" />
            </View>
            <Text style={styles.summaryLabel}>Money Out</Text>
            <Text style={[styles.summaryAmount, { color: "#FF4444" }]}>
              -${totalOut.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                activeFilter === f && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(f)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === f && styles.filterTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Transaction list ─────────────────────────────────────────────── */}
        <View style={styles.list}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="inbox" size={28} color="rgba(255,255,255,0.2)" />
              </View>
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          ) : (
            filtered.map((tx, index) => (
              <TouchableOpacity
                key={tx.id}
                style={[
                  styles.txRow,
                  index < filtered.length - 1 && styles.txRowBorder,
                ]}
                activeOpacity={0.7}
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
                      {
                        color:
                          tx.type === "sent" || tx.type === "offramp"
                            ? "#FF4444"
                            : "#00D4A0",
                      },
                    ]}
                  >
                    {tx.amount}
                  </Text>
                  <Text style={styles.txNaira}>{tx.naira}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
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

  // ── Summary ───────────────────────────────────────────────────────────────────
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  summaryAmount: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },

  // ── Filters ───────────────────────────────────────────────────────────────────
  filtersRow: {
    paddingRight: 20,
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  filterTextActive: {
    color: ACCENT_FG,
    fontFamily: "Inter_600SemiBold",
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  list: {
    backgroundColor: "#111111",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 14,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
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

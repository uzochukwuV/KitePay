import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TRANSACTIONS = [
  { id: "1", type: "received", label: "Received from Ada", amount: "+$45.00", naira: "+₦67,500", date: "Apr 12, 2:30 PM", icon: "arrow-down-left", color: "#10B981" },
  { id: "2", type: "sent", label: "Sent to Chidi", amount: "-$12.00", naira: "-₦18,000", date: "Apr 12, 10:15 AM", icon: "arrow-up-right", color: "#EF4444" },
  { id: "3", type: "onramp", label: "NGN → USDC", amount: "+$100.00", naira: "+₦150,000", date: "Apr 11, 4:20 PM", icon: "repeat", color: "#2563EB" },
  { id: "4", type: "yield", label: "Yield Earned", amount: "+$0.48", naira: "+₦720", date: "Apr 11, 12:00 AM", icon: "trending-up", color: "#8B5CF6" },
  { id: "5", type: "offramp", label: "USDC → NGN", amount: "-$50.00", naira: "-₦75,000", date: "Apr 10, 3:45 PM", icon: "repeat", color: "#F59E0B" },
  { id: "6", type: "sent", label: "Sent to Emeka", amount: "-$8.50", naira: "-₦12,750", date: "Apr 10, 11:00 AM", icon: "arrow-up-right", color: "#EF4444" },
  { id: "7", type: "received", label: "Received from Kemi", amount: "+$200.00", naira: "+₦300,000", date: "Apr 9, 6:00 PM", icon: "arrow-down-left", color: "#10B981" },
  { id: "8", type: "yield", label: "Yield Earned", amount: "+$0.46", naira: "+₦690", date: "Apr 9, 12:00 AM", icon: "trending-up", color: "#8B5CF6" },
  { id: "9", type: "received", label: "Received USDC", amount: "+$320.00", naira: "+₦480,000", date: "Apr 8, 3:10 PM", icon: "arrow-down-left", color: "#10B981" },
  { id: "10", type: "sent", label: "Merchant Payment", amount: "-$25.00", naira: "-₦37,500", date: "Apr 7, 1:00 PM", icon: "arrow-up-right", color: "#EF4444" },
];

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#0D1117" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <TouchableOpacity style={styles.filterBtn}>
          <Feather name="sliders" size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={TRANSACTIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              styles.txRow,
              index < TRANSACTIONS.length - 1 && styles.txRowBorder,
            ]}
            activeOpacity={0.7}
          >
            <View style={[styles.txIcon, { backgroundColor: item.color + "18" }]}>
              <Feather name={item.icon as any} size={18} color={item.color} />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txLabel}>{item.label}</Text>
              <Text style={styles.txDate}>{item.date}</Text>
            </View>
            <View style={styles.txAmounts}>
              <Text
                style={[
                  styles.txAmount,
                  {
                    color:
                      item.type === "sent" || item.type === "offramp"
                        ? "#EF4444"
                        : "#0D1117",
                  },
                ]}
              >
                {item.amount}
              </Text>
              <Text style={styles.txNaira}>{item.naira}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>
              {TRANSACTIONS.length} transactions
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#0D1117" },
  filterBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 20, paddingTop: 16 },
  listHeader: { marginBottom: 12 },
  listHeaderText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
  },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#0D1117", marginBottom: 2 },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  txAmounts: { alignItems: "flex-end" },
  txAmount: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  txNaira: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
});

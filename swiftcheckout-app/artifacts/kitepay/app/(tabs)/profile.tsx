import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
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

const MENU_ITEMS = [
  {
    section: "Account",
    items: [
      { label: "Personal Information", icon: "user", route: null, badge: null },
      { label: "KYC Verification", icon: "shield", badge: "Pending", route: null },
      { label: "Bank Accounts", icon: "credit-card", route: null, badge: null },
      { label: "Linked Wallets", icon: "link", route: null, badge: null },
    ],
  },
  {
    section: "Preferences",
    items: [
      { label: "Notifications", icon: "bell", route: null, badge: null },
      { label: "Security & PIN", icon: "lock", route: null, badge: null },
      { label: "Currency Display", icon: "globe", route: null, badge: null },
      { label: "Language", icon: "type", route: null, badge: null },
    ],
  },
  {
    section: "Support",
    items: [
      { label: "Help Center", icon: "help-circle", route: null, badge: null },
      { label: "Terms of Service", icon: "file-text", route: null, badge: null },
      { label: "Privacy Policy", icon: "eye-off", route: null, badge: null },
    ],
  },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("user@kitepay.io");

  useEffect(() => {
    AsyncStorage.getItem("userName").then((n) => { if (n) setUserName(n); });
    AsyncStorage.getItem("userEmail").then((e) => { if (e) setUserEmail(e); });
  }, []);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await AsyncStorage.removeItem("onboarded");
          router.replace("/onboarding");
        },
      },
    ]);
  };

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) },
        ]}
      >
        <Text style={styles.title}>Profile</Text>
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
        {/* ── Profile Card ─────────────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileEmail}>{userEmail}</Text>
          </View>
          <View style={styles.kycBadge}>
            <Feather name="alert-circle" size={12} color="#FFB800" />
            <Text style={styles.kycText}>KYC Pending — Verify to unlock limits</Text>
          </View>
        </View>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          {[
            { label: "Total Sent", value: "$820.50", color: "#FF4444" },
            { label: "Total Received", value: "$1,245.80", color: "#00D4A0" },
            { label: "Yield Earned", value: "$14.20", color: ACCENT },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Menu ─────────────────────────────────────────────────────────── */}
        {MENU_ITEMS.map((section) => (
          <View key={section.section} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.section}</Text>
            <View style={styles.menuGroup}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    index < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuLeft}>
                    <View style={styles.menuIcon}>
                      <Feather name={item.icon as any} size={16} color={ACCENT} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.menuRight}>
                    {item.badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                    <Feather name="chevron-right" size={15} color="rgba(255,255,255,0.2)" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* ── Sign Out ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={17} color="#FF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>KitePay v1.0.0 · Kite Chain</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  header: { marginBottom: 16, paddingHorizontal: 20 },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },

  // ── Profile card ──────────────────────────────────────────────────────────────
  profileCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(200,255,0,0.1)",
    borderWidth: 2,
    borderColor: "rgba(200,255,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  avatarText: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: ACCENT,
  },
  profileInfo: { alignItems: "center", gap: 3 },
  profileName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  kycBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,184,0,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.2)",
    marginTop: 2,
  },
  kycText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#FFB800",
  },

  // ── Stats ─────────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  statValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
  },

  // ── Menu ──────────────────────────────────────────────────────────────────────
  menuSection: { marginBottom: 20 },
  menuSectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingLeft: 4,
  },
  menuGroup: {
    backgroundColor: "#111111",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(200,255,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
  },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    backgroundColor: "rgba(255,184,0,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,184,0,0.2)",
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#FFB800",
  },

  // ── Logout ────────────────────────────────────────────────────────────────────
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,68,68,0.07)",
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.15)",
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FF4444",
  },
  version: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
    marginBottom: 8,
  },
});

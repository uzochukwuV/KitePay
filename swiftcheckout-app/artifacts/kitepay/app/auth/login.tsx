import * as Haptics from "expo-haptics";
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
import { useWallet } from "../../hooks/useWallet";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCENT = "#C8FF00";
const ACCENT_FG = "#000000";

export default function ImportWalletScreen() {
  const insets = useSafeAreaInsets();
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const { importWallet } = useWallet();

  const handleImport = async () => {
    if (!privateKey.trim()) {
      setError("Please enter your private key");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await importWallet(privateKey);
      await AsyncStorage.setItem("onboarded", "true");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Invalid private key");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.bg}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 32),
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Feather name="key" size={22} color={ACCENT} />
            </View>
            <Text style={styles.title}>Import Wallet</Text>
            <Text style={styles.subtitle}>
              Enter your Ethereum private key to restore your wallet
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {!!error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={15} color="#FF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Private Key</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focused && styles.inputWrapperFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="0x..."
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={privateKey}
                  onChangeText={setPrivateKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  numberOfLines={3}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
              </View>
              <Text style={styles.hint}>
                Your key is stored locally and never leaves your device.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.importBtn, loading && styles.importBtnDisabled]}
              onPress={handleImport}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={ACCENT_FG} />
              ) : (
                <Text style={styles.importText}>Import Wallet</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => router.replace("/onboarding")}
              activeOpacity={0.8}
            >
              <Text style={styles.createBtnText}>Create New Wallet</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#000000" },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  backBtn: {
    position: "absolute",
    top: 24,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  header: {
    marginBottom: 40,
    gap: 12,
    marginTop: 60,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(200,255,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(200,255,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 22,
  },
  form: { gap: 16 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.25)",
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#FF4444",
    flex: 1,
  },
  fieldGroup: { gap: 8 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.2,
  },
  inputWrapper: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    overflow: "hidden",
  },
  inputWrapperFocused: {
    borderColor: "#C8FF00",
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    minHeight: 90,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.25)",
    lineHeight: 18,
  },
  importBtn: {
    borderRadius: 16,
    backgroundColor: "#C8FF00",
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 4,
  },
  importBtnDisabled: {
    opacity: 0.7,
  },
  importText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#000000",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dividerText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
  },
  createBtn: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 17,
    alignItems: "center",
  },
  createBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

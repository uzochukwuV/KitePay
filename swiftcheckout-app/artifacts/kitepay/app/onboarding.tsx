import { useWallet } from "../hooks/useWallet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const ACCENT = "#C8FF00";
const ACCENT_FG = "#000000";

const slides = [
  {
    id: "1",
    title: "Instant NGN\nto USDC",
    subtitle:
      "Convert your Naira to USDC stablecoin in seconds. No bank delays, no hidden fees.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
    tag: "Zero Fees",
  },
  {
    id: "2",
    title: "Send & Receive\nGlobally",
    subtitle:
      "Pay anyone anywhere with Kite Chain. Lightning-fast transactions with near-zero fees.",
    image:
      "https://images.unsplash.com/photo-1614028674026-a65e31bfd27c?q=80&w=2070&auto=format&fit=crop",
    tag: "Global",
  },
  {
    id: "3",
    title: "Your Wallet,\nYour Choice",
    subtitle:
      "Create a new wallet instantly or import an existing one with your private key.",
    image:
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop",
    tag: "Get Started",
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { createWallet } = useWallet();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isLast = currentIndex === slides.length - 1;

  /** Animate slide transition */
  const goToSlide = useCallback(
    (nextIndex: number) => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
      // Update index mid-animation so image swaps during fade-out
      setTimeout(() => setCurrentIndex(nextIndex), 180);
    },
    [fadeAnim]
  );

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      goToSlide(currentIndex + 1);
    }
  };

  /** Skip straight to the final choices slide */
  const handleSkip = () => {
    if (!isLast) {
      goToSlide(slides.length - 1);
    }
  };

  /** Only called when user explicitly taps "Create New Wallet" */
  const handleCreateWallet = async () => {
    if (loading) return;
    try {
      setLoading(true);
      await createWallet();
      await AsyncStorage.setItem("onboarded", "true");
      router.replace("/(tabs)");
    } catch (e) {
      console.error("createWallet failed", e);
    } finally {
      setLoading(false);
    }
  };

  const slide = slides[currentIndex];

  return (
    <View style={styles.container}>
      {/* ── Background image (fades on slide change) ─────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <Image
          source={{ uri: slide.image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.6)", "#000000"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Top: Skip button ─────────────────────────────────────────────── */}
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) },
        ]}
      >
        {!isLast ? (
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipBtn}
            accessibilityLabel="Skip to get started"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View /> /* spacer to keep layout stable */
        )}
      </View>

      {/* ── Slide content (text area at bottom) ──────────────────────────── */}
      <Animated.View
        style={[
          styles.slideContent,
          {
            opacity: fadeAnim,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 180,
          },
        ]}
      >
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{slide.tag}</Text>
        </View>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
      </Animated.View>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
          },
        ]}
      >
        {/* Progress dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goToSlide(i)}
              accessibilityLabel={`Go to slide ${i + 1}`}
            >
              <View
                style={[
                  styles.dot,
                  i === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        {isLast ? (
          /* ── Last slide: wallet choice ─────────────────────────────────── */
          <View style={styles.choiceButtons}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleCreateWallet}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={ACCENT_FG} />
              ) : (
                <>
                  <Feather name="plus-circle" size={18} color={ACCENT_FG} />
                  <Text style={styles.primaryBtnText}>Create New Wallet</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/auth/login")}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Feather name="key" size={18} color="#FFFFFF" />
              <Text style={styles.secondaryBtnText}>Import Private Key</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Regular slide: Next button ─────────────────────────────────── */
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <Feather name="arrow-right" size={18} color={ACCENT_FG} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  // ── Top bar ───────────────────────────────────────────────────────────────────
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "flex-end",
    zIndex: 10,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },

  // ── Slide text ────────────────────────────────────────────────────────────────
  slideContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    gap: 14,
  },
  tagPill: {
    alignSelf: "flex-start",
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ACCENT_FG,
    letterSpacing: 0.4,
  },
  slideTitle: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -1,
    lineHeight: 48,
  },
  slideSubtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    lineHeight: 24,
  },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 20,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 28,
    backgroundColor: ACCENT,
  },
  dotInactive: {
    width: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  // ── Next button ───────────────────────────────────────────────────────────────
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 17,
  },
  nextBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: ACCENT_FG,
  },

  // ── Last slide: wallet choice ─────────────────────────────────────────────────
  choiceButtons: {
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 17,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: ACCENT_FG,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

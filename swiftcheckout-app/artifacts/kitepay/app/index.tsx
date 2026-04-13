import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { Image } from "expo-image";
import React, { useEffect } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SplashEntry() {
  const insets = useSafeAreaInsets();
  const scaleAnim = React.useRef(new Animated.Value(0.75)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const taglineOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 55,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start();

    const navigate = async () => {
      await new Promise((r) => setTimeout(r, 2600));
      const privateKey = await SecureStore.getItemAsync("kitepay_wallet_private_key");
      if (!privateKey) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    };
    navigate();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Logo lockup */}
      <Animated.View
        style={[
          styles.logoRow,
          { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Image
          source={require("../assets/images/astronaut.png")}
          style={styles.astronaut}
          contentFit="contain"
        />
        <Text style={styles.appName}>
          KitePay<Text style={styles.dot}>.</Text>
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineContainer, { opacity: taglineOpacity }]}>
        <Text style={styles.tagline}>Borderless Payments.</Text>
        <Text style={styles.taglineSub}>West Africa & Beyond.</Text>
      </Animated.View>

      {/* Loading indicator */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 32 }]}>
        <Animated.View style={[styles.loadingBar, { opacity: taglineOpacity }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  astronaut: {
    width: 56,
    height: 56,
  },
  appName: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 1.2,
  },
  dot: {
    color: "#C8FF00",
  },
  taglineContainer: {
    marginTop: 28,
    alignItems: "center",
    gap: 4,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.3,
  },
  taglineSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 0.2,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  loadingBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C8FF00",
    opacity: 0.8,
  },
});

import React, { useEffect, useRef } from "react";
import { 
  View, 
  Text,
  StyleSheet, 
  Animated, 
  ImageBackground,
  StatusBar, 
  Dimensions 
} from "react-native";
import colors from "../utils/colors";

import { getStoredAuthToken, setAuthToken } from "../services/api";

const { width } = Dimensions.get("window");

const splashBackground = require("../assets/images/splash_screen_banner.png");

export default function SplashScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const dot1 = useRef(new Animated.Value(0.4)).current;
  const dot2 = useRef(new Animated.Value(0.4)).current;
  const dot3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulseDot = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.4,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.delay(100),
        ])
      );

    const dotAnimations = [
      pulseDot(dot1, 0),
      pulseDot(dot2, 120),
      pulseDot(dot3, 240),
    ];

    const mainAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]);

    mainAnimation.start();
    dotAnimations.forEach((animation) => animation.start());

    const checkAuthAndNavigate = async () => {
      try {
        const storedToken = await getStoredAuthToken();
        setTimeout(() => {
          if (storedToken && storedToken.trim().length > 0) {
            setAuthToken(storedToken);
            navigation.replace("Home");
          } else {
            navigation.replace("Login");
          }
        }, 2200);
      } catch (err) {
        console.warn("[Splash] Auth check error:", err);
        setTimeout(() => {
          navigation.replace("Login");
        }, 2200);
      }
    };

    checkAuthAndNavigate();

    return () => {
      dotAnimations.forEach((animation) => animation.stop());
    };
  }, [navigation, fadeAnim, scaleAnim, dot1, dot2, dot3]);

  return (
    <ImageBackground
      source={splashBackground}
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.overlay} />
      <Animated.View 
        style={[
          styles.logoContainer, 
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        
      </Animated.View>

      <View style={styles.footer}>
        {/* <Animated.Text style={[styles.tagline, { opacity: fadeAnim }]}>
          Trusted Transit • Affordable Prices
        </Animated.Text> */}
        {/* <View style={styles.loaderContainer}>
            <View style={styles.lineLoader} />
        </View> */}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  backgroundImage: {
    width: 0,
    height: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: -80,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.textInverse,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 50,
    alignItems: "center",
  },
  loaderLabel: {
    color: "rgba(255,255,255,0.88)",
    marginBottom: 14,
    fontSize: 13,
    letterSpacing: 0.6,
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    marginHorizontal: 8,
  },
});
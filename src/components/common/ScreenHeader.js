import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import AppIcon from "./AppIcon";

export default function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  children,
  variant = "primary",
  compact = false,
}) {
  const insets = useSafeAreaInsets();

  const getGradientColors = () => {
    if (variant === "transparent") {
      return ["#FFFFFF00", "#FFFFFF00"];
    }
    return ["#0B2545", "#134074", "#0077B6"];
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: 0 }]} edges={['top']}>
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          compact && styles.headerCompact,
          { paddingTop: Math.max(insets.top, 12) },
        ]}
      >
        <View style={styles.decoration} pointerEvents="none">
          <View style={styles.circleOne} />
          <View style={styles.circleTwo} />
        </View>

        <View style={[styles.topRow, compact && styles.topRowCompact]}>
          {showBack ? (
            <TouchableOpacity
              onPress={onBack}
              activeOpacity={0.75}
              style={styles.backButton}
            >
              <AppIcon library="Ionicons" name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.sideSpacer} />
          )}

          <View style={styles.titleBlock}>
            {eyebrow ? (
              <Text style={styles.eyebrow} numberOfLines={1}>
                {eyebrow}
              </Text>
            ) : null}
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.rightArea}>{rightAction || <View style={styles.sideSpacer} />}</View>
        </View>

        {children ? <View style={styles.childContainer}>{children}</View> : null}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    width: "100%",
    backgroundColor: "transparent",
  },
  header: {
    minHeight: 170,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    position: "relative",
  },
  headerCompact: {
    minHeight: 144,
  },
  decoration: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  circleOne: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    top: -50,
    right: -40,
  },
  circleTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    bottom: -35,
    left: -20,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    width: "100%",
    zIndex: 1,
  },
  topRowCompact: {
    alignItems: "center",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    flexShrink: 0,
  },
  sideSpacer: {
    width: 42,
    height: 42,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 12,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
  },
  subtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  rightArea: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 42,
  },
  childContainer: {
    marginTop: 20,
    zIndex: 1,
  },
});

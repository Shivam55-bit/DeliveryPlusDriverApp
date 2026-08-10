import React, { memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "./common/AppIcon";
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
} from "../theme/tokens";

const ModernHeader = memo(
  ({
    title,
    subtitle,
    leftIcon,
    onLeftPress,
    rightIcon,
    onRightPress,
    variant = "default",
  }) => {
    const insets = useSafeAreaInsets();

    const getVariantStyles = () => {
      switch (variant) {
        case "primary":
          return {
            backgroundColor: COLORS.primary.darkest,
            titleColor: COLORS.white,
            subtitleColor: "rgba(255,255,255,0.8)",
          };
        case "transparent":
          return {
            backgroundColor: "transparent",
            titleColor: COLORS.text.primary,
            subtitleColor: COLORS.text.secondary,
          };
        default:
          return {
            backgroundColor: COLORS.surface,
            titleColor: COLORS.text.primary,
            subtitleColor: COLORS.text.secondary,
          };
      }
    };

    const variantStyles = getVariantStyles();

    return (
      <View
        style={[
          styles.header,
          { backgroundColor: variantStyles.backgroundColor },
        ]}
      >
        <SafeAreaView edges={["top", "left", "right"]}>
          <View style={styles.container}>
            <View style={styles.left}>
              {leftIcon && (
                <TouchableOpacity
                  onPress={onLeftPress}
                  activeOpacity={0.7}
                  style={styles.iconButton}
                >
                  {leftIcon}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.center}>
              <Text
                style={[
                  styles.title,
                  { color: variantStyles.titleColor },
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {subtitle && (
                <Text
                  style={[
                    styles.subtitle,
                    { color: variantStyles.subtitleColor },
                  ]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              )}
            </View>

            <View style={styles.right}>
              {rightIcon && (
                <TouchableOpacity
                  onPress={onRightPress}
                  activeOpacity={0.7}
                  style={styles.iconButton}
                >
                  {rightIcon}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }
);

ModernHeader.displayName = "ModernHeader";

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 56,
  },
  left: {
    flex: 0.15,
    alignItems: "flex-start",
  },
  center: {
    flex: 0.7,
    alignItems: "center",
  },
  right: {
    flex: 0.15,
    alignItems: "flex-end",
  },
  title: {
    ...TYPOGRAPHY.h5,
    fontWeight: "800",
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
  },
  iconButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.full,
  },
});

export default ModernHeader;

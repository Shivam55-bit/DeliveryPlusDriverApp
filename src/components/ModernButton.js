import React, { memo } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS, DURATION } from "../theme/tokens";

const ModernButton = memo(
  ({
    label,
    onPress,
    variant = "primary",
    size = "lg",
    disabled = false,
    loading = false,
    icon,
    style,
    testID,
  }) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "primary":
          return [
            styles.primary,
            disabled && styles.disabled,
          ];
        case "secondary":
          return [
            styles.secondary,
            disabled && styles.disabled,
          ];
        case "outline":
          return [
            styles.outline,
            disabled && styles.outlineDisabled,
          ];
        case "ghost":
          return [
            styles.ghost,
            disabled && styles.ghostDisabled,
          ];
        default:
          return styles.primary;
      }
    };

    const getSizeStyles = () => {
      switch (size) {
        case "sm":
          return styles.sm;
        case "md":
          return styles.md;
        case "lg":
          return styles.lg;
        default:
          return styles.lg;
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.button,
          getVariantStyles(),
          getSizeStyles(),
          style,
        ]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.7}
        testID={testID}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === "primary"
                ? COLORS.white
                : COLORS.primary.main
            }
          />
        ) : (
          <View style={styles.content}>
            {icon}
            <Text
              style={[
                styles.text,
                variant === "primary" && styles.textPrimary,
                variant === "secondary" &&
                  styles.textSecondary,
                variant === "outline" &&
                  styles.textOutline,
                variant === "ghost" && styles.textGhost,
                disabled && styles.textDisabled,
              ]}
            >
              {label}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }
);

ModernButton.displayName = "ModernButton";

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.lg,
    ...SHADOWS.sm,
  },

  // Variants
  primary: {
    backgroundColor: COLORS.primary.main,
  },
  secondary: {
    backgroundColor: COLORS.primary.light,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.primary.main,
  },
  ghost: {
    backgroundColor: "transparent",
  },

  // Disabled states
  disabled: {
    opacity: 0.5,
  },
  outlineDisabled: {
    borderColor: COLORS.border,
  },
  ghostDisabled: {
    opacity: 0.5,
  },

  // Sizes
  sm: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 36,
  },
  md: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 44,
  },
  lg: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    minHeight: 52,
  },

  // Content
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  // Text styles
  text: {
    ...TYPOGRAPHY.body1,
    fontWeight: "700",
  },
  textPrimary: {
    color: COLORS.white,
  },
  textSecondary: {
    color: COLORS.primary.darkest,
  },
  textOutline: {
    color: COLORS.primary.main,
  },
  textGhost: {
    color: COLORS.primary.main,
  },
  textDisabled: {
    color: COLORS.text.muted,
  },
});

export default ModernButton;

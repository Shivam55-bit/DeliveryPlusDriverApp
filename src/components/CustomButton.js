import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import colors from "../utils/colors";

export default function CustomButton({
  title,
  onPress,
  style,
  disabled,
  loading,
  variant = "primary", // primary, secondary, success, danger
  size = "medium", // small, medium, large
  fullWidth = false,
}) {
  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[size], fullWidth && styles.fullWidth, style];

    if (variant === "secondary") {
      return [baseStyle, styles.secondary];
    }
    if (variant === "success") {
      return [baseStyle, styles.success];
    }
    if (variant === "danger") {
      return [baseStyle, styles.danger];
    }
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseText = [styles.text, styles[size + "Text"]];

    if (variant === "secondary") {
      return [baseText, styles.secondaryText];
    }
    return baseText;
  };

  const renderContent = () => (
    <>
      {loading && <ActivityIndicator size="small" color={colors.textInverse} style={styles.loader} />}
      <Text style={getTextStyle()}>{title}</Text>
    </>
  );

  const buttonStyle = getButtonStyle();
  const flattenedButtonStyle = StyleSheet.flatten(buttonStyle);
  const borderRadius = flattenedButtonStyle?.borderRadius || 20;

  if (variant === "primary") {
    return (
      <TouchableOpacity
        style={[buttonStyle, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={colors.gradient.primary}
          style={[styles.gradient, { borderRadius }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[getButtonStyle(), disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: colors.shadow.heavy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },

  gradient: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderRadius: 20,
  },

  // Sizes
  small: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
  },

  medium: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48,
  },

  large: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 56,
  },

  fullWidth: {
    width: "100%",
  },

  // Variants
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  success: {
    backgroundColor: colors.success,
  },

  danger: {
    backgroundColor: colors.error,
  },

  // Text styles
  text: {
    color: colors.textInverse,
    fontWeight: "600",
    textAlign: "center",
  },

  smallText: {
    fontSize: 14,
  },

  mediumText: {
    fontSize: 16,
  },

  largeText: {
    fontSize: 18,
  },

  secondaryText: {
    color: colors.primary,
  },

  // States
  disabled: {
    opacity: 0.5,
  },

  loader: {
    marginRight: 8,
  },
});

import React, { memo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../theme/tokens";

const ModernCard = memo(
  ({
    children,
    style,
    onPress,
    variant = "default",
    padding = SPACING.lg,
  }) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "elevated":
          return styles.elevated;
        case "outlined":
          return styles.outlined;
        case "surface":
          return styles.surface;
        default:
          return styles.default;
      }
    };

    const Container = onPress ? TouchableOpacity : View;
    const touchableProps = onPress
      ? { onPress, activeOpacity: 0.92 }
      : {};

    return (
      <Container
        style={[
          styles.card,
          getVariantStyles(),
          { padding },
          style,
        ]}
        {...touchableProps}
      >
        {children}
      </Container>
    );
  }
);

ModernCard.displayName = "ModernCard";

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  // Variants
  default: {
    ...SHADOWS.md,
  },
  elevated: {
    ...SHADOWS.lg,
  },
  outlined: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  surface: {
    backgroundColor: COLORS.surfaceSecondary,
  },
});

export default ModernCard;

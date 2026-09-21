import React from "react";
import { View, Text, StyleSheet } from "react-native";
import colors from "../utils/colors";
import AppIcon from "./common/AppIcon";

export default function EmptyState({
  icon = "package-variant-closed",
  title = "No items found",
  subtitle,
  action,
}) {
  return (
    <View style={styles.container}>
      <AppIcon library="MaterialCommunityIcons" name={icon} size={64} color={colors.textMuted} style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },

  icon: {
    marginBottom: 16,
    opacity: 0.5,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  action: {
    marginTop: 24,
  },
});
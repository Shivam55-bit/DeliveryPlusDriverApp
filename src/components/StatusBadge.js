import React from "react";
import { View, Text, StyleSheet } from "react-native";
import colors from "../utils/colors";

export default function StatusBadge({
  status,
  text,
  size = "medium",
  style,
}) {
  const getStatusColor = () => {
    switch (status) {
      case "upcoming":
        return colors.status.upcoming;
      case "inProgress":
        return colors.status.inProgress;
      case "completed":
        return colors.status.completed;
      case "cancelled":
        return colors.status.cancelled;
      default:
        return colors.status.upcoming;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case "upcoming":
        return colors.accent;
      case "inProgress":
        return colors.success;
      case "completed":
        return colors.primary;
      case "cancelled":
        return colors.error;
      default:
        return colors.accent;
    }
  };

  return (
    <View style={[styles.badge, styles[size], { backgroundColor: getStatusColor() }, style]}>
      <Text style={[styles.text, styles[size + "Text"], { color: getTextColor() }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  small: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  medium: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  large: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },

  text: {
    fontWeight: "600",
    textAlign: "center",
  },

  smallText: {
    fontSize: 12,
  },

  mediumText: {
    fontSize: 14,
  },

  largeText: {
    fontSize: 16,
  },
});
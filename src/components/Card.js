import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import colors from "../utils/colors";

export default function Card({
  children,
  style,
  onPress,
  padding = 16,
  marginBottom = 12,
  shadow = "light",
  borderRadius = 12,
}) {
  const cardStyle = [
    styles.card,
    {
      padding,
      marginBottom,
      borderRadius,
      shadowColor: colors.shadow[shadow],
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
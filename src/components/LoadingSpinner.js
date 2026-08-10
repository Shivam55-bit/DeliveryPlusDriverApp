import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import colors from "../utils/colors";

export default function LoadingSpinner({
  size = "large",
  color = colors.primary,
  text,
  fullScreen = false,
}) {
  const containerStyle = fullScreen ? styles.fullScreen : styles.container;

  return (
    <View style={containerStyle}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  fullScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  text: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
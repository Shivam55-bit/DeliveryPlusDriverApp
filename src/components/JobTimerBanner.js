import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useElapsedTime, formatFormattedTimer } from "../utils/jobHelpers";

const JobTimerBanner = memo(({ startedAt, style }) => {
  const seconds = useElapsedTime(startedAt, true);

  return (
    <View style={[styles.timerBanner, style]}>
      <View style={styles.timerLeft}>
        <View style={styles.pulseDot} />
        <Text style={styles.timerTitle}>Running Timer</Text>
      </View>
      <Text style={styles.timerClock}>{formatFormattedTimer(seconds)}</Text>
    </View>
  );
});

export default JobTimerBanner;

const styles = StyleSheet.create({
  timerBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0B2545",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  timerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#38BDF8",
  },
  timerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  timerClock: {
    fontSize: 15,
    fontWeight: "900",
    color: "#38BDF8",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
});

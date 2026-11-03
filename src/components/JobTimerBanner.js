import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useElapsedTime, formatFormattedTimer } from "../utils/jobHelpers";

const JobTimerBanner = memo(({ startedAt, pauseIntervals = [], isPaused = false, isRunning = true, style }) => {
  const seconds = useElapsedTime(startedAt, !isPaused && isRunning, pauseIntervals, isPaused);

  return (
    <View style={[styles.timerBanner, isPaused && styles.pausedBanner, style]}>
      <View style={styles.timerLeft}>
        <View style={[styles.pulseDot, isPaused && styles.pausedDot]} />
        <Text style={styles.timerTitle}>
          {isPaused ? "Timer Paused" : "Running Timer"}
        </Text>
      </View>
      <Text style={[styles.timerClock, isPaused && styles.pausedClock]}>
        {formatFormattedTimer(seconds)}
      </Text>
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
  pausedBanner: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  pausedDot: {
    backgroundColor: "#F59E0B",
  },
  pausedClock: {
    color: "#FBBF24",
  },
});

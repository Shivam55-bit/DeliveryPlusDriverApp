import React from "react";
import { View, Text, StyleSheet, SafeAreaView, FlatList } from "react-native";
import AppIcon from "../components/common/AppIcon";
import Card from "../components/Card";

const historyItems = [
  { id: "H-001", customer: "Amit Sharma", route: "CP → Gurgaon", date: "May 2, 2026" },
  { id: "H-002", customer: "Priya Mehta", route: "Lajpat Nagar → Noida", date: "May 2, 2026" },
  { id: "H-003", customer: "Rohit Verma", route: "Dwarka → Faridabad", date: "May 1, 2026" },
];

export default function DeliveryHistoryScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery History</Text>
        <Text style={styles.subtitle}>Review your recent completed moves.</Text>
      </View>

      <FlatList
        data={historyItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.customer}</Text>
            </View>
            <Text style={styles.cardSubtitle}>{item.route}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.badge}>
                <AppIcon library="Ionicons" name="checkmark-circle" size={14} color="#0A2B66" />
                <Text style={styles.badgeText}>{item.date}</Text>
              </View>
              <Text style={styles.badgeLabel}>Completed</Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No delivery history available yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F6FA",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 24,
    backgroundColor: "#0A2B66",
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: "85%",
  },
  list: {
    padding: 20,
  },
  card: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#101828",
  },
  cardEarnings: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2B66",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#475467",
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDF2FF",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  badgeText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#0A2B66",
    fontWeight: "600",
  },
  badgeLabel: {
    fontSize: 12,
    color: "#667085",
  },
  emptyText: {
    marginTop: 40,
    textAlign: "center",
    color: "#667085",
    fontSize: 15,
  },
});
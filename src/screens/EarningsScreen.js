import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import LoadingSpinner from "../components/LoadingSpinner";
import AppIcon from "../components/common/AppIcon";

const C = {
  bg: "#F3F6FA",
  navy: "#102A5B",
  blue: "#2563EB",
  blueSoft: "#EFF6FF",
  white: "#FFFFFF",
  border: "#E5E7EB",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  success: "#16A34A",
  successBg: "#ECFDF5",
  orange: "#F59E0B",
  orangeBg: "#FFFBEB",
};

const earningsData = [
  {
    id: "1026",
    title: "Job #1026",
    customer: "Neha Singh",
    amount: 2250,
    note: "31 May 2024 • 4.5 hrs",
    status: "Paid",
    icon: "briefcase-check",
    color: "#10B981",
  },
  {
    id: "1025",
    title: "Job #1025",
    customer: "Amit Verma",
    amount: 1500,
    note: "31 May 2024 • 3.0 hrs",
    status: "Paid",
    icon: "package-variant-closed",
    color: "#2563EB",
  },
  {
    id: "1024",
    title: "Job #1024",
    customer: "Rahul Sharma",
    amount: 2500,
    note: "30 May 2024 • 5.0 hrs",
    status: "Paid",
    icon: "truck-delivery",
    color: "#F59E0B",
  },
];
const breakupData = [
  {
    title: "Job Earnings",
    subtitle: "From 28 Jobs",
    amount: 22400,
    icon: "briefcase-outline",
    color: "#10B981",
    bg: "#ECFDF5",
  },
  {
    title: "Extra Charges",
    subtitle: "Tolls, Stairs, Long Distance",
    amount: 1850,
    icon: "currency-inr",
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  {
    title: "Tips",
    subtitle: "From Customers",
    amount: 600,
    icon: "heart-outline",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
];
export default function EarningsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTransactions(earningsData);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const totalEarnings = 24850;
  const weekEarnings = 8450;
  const todayEarnings = 2150;
  const lastMonthEarnings = 22700;

  const renderTransaction = ({ item }) => (
    <TouchableOpacity style={styles.transactionCard} activeOpacity={0.85}>
      <View style={styles.transactionLeft}>
        <View style={[styles.transactionIcon, { backgroundColor: item.color + "22" }]}>
          <AppIcon library="MaterialCommunityIcons" name={item.icon} size={22} color={item.color} />
        </View>
        <View style={styles.transactionText}>
          <Text style={styles.transactionTitle}>{item.title}</Text>
          <Text style={styles.transactionSubtitle}>{item.customer}</Text>
          <Text style={styles.transactionNote}>{item.note}</Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading earnings..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>Summary</Text>
              </View>
              <Text style={styles.heroAmount}>--</Text>
            </View>

            <View style={styles.breakupSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Earnings Breakup</Text>
                <Text style={styles.sectionAction}>View All</Text>
              </View>
              {breakupData.map((item) => (
                <View key={item.title} style={styles.breakupCard}>
                  <View style={[styles.breakupIcon, { backgroundColor: item.bg }]}>
                    <AppIcon library="MaterialCommunityIcons" name={item.icon} size={18} color={item.color} />
                  </View>
                  <View style={styles.breakupText}>
                    <Text style={styles.breakupTitle}>{item.title}</Text>
                    <Text style={styles.breakupSubtitle}>{item.subtitle}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.transactionsHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <Text style={styles.sectionAction}>View All</Text>
            </View>
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingBottom: 28,
  },
  heroCard: {
    marginHorizontal: 6,
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: C.navy,
    padding: 22,
    shadowColor: "rgba(0,0,0,0.12)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "700",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroBadgeText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
    marginRight: 6,
  },
  heroAmount: {
    color: C.white,
    fontSize: 42,
    fontWeight: "900",
    marginBottom: 22,
  },
  heroStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroStatItem: {
    width: "30%",
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
  heroStatValue: {
    color: C.white,
    fontSize: 16,
    fontWeight: "900",
  },
  breakupSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.textPrimary,
  },
  sectionAction: {
    fontSize: 12,
    color: C.blue,
    fontWeight: "700",
  },
  breakupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  breakupIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  breakupText: {
    flex: 1,
  },
  breakupTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 4,
  },
  breakupSubtitle: {
    fontSize: 11,
    color: C.textMuted,
    lineHeight: 16,
  },
  breakupAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: C.textPrimary,
  },
  transactionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.white,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  transactionIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  transactionText: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 4,
  },
  transactionSubtitle: {
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: 4,
  },
  transactionNote: {
    fontSize: 11,
    color: C.textMuted,
  },
  transactionRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "900",
    color: C.blue,
    marginBottom: 8,
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: C.successBg,
  },
  statusText: {
    color: C.success,
    fontSize: 11,
    fontWeight: "700",
  },
});
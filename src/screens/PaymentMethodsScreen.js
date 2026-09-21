import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import colors from "../utils/colors";
import AppIcon from "../components/common/AppIcon";
import Card from "../components/Card";
import CustomButton from "../components/CustomButton";

export default function PaymentMethodsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [paymentMethods, setPaymentMethods] = useState([]);

  const handleAddPayment = () => {
    Alert.alert("Add Payment Method", "Feature coming soon. Please use the web portal.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <LinearGradient colors={colors.gradient.primary} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <AppIcon library="Ionicons" name="arrow-back" size={24} color={colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Methods</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {paymentMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <AppIcon library="MaterialCommunityIcons" name="credit-card-off" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No Payment Methods Added</Text>
              <Text style={styles.emptySubtext}>
                Add a credit card or bank account to receive payments
              </Text>

              <CustomButton
                title="Add Payment Method"
                onPress={handleAddPayment}
                style={{ marginTop: 24 }}
                fullWidth
              />
            </View>
          ) : (
            paymentMethods.map((method, idx) => (
              <Card key={idx} style={styles.paymentCard}>
                <View style={styles.methodRow}>
                  <AppIcon library="MaterialCommunityIcons" name="credit-card" size={24} color={colors.primary} />
                  <View style={styles.methodDetails}>
                    <Text style={styles.methodType}>{method.type}</Text>
                    <Text style={styles.methodLast}>****{method.last4}</Text>
                  </View>
                  <TouchableOpacity>
                    <AppIcon library="MaterialCommunityIcons" name="dots-vertical" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}

          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <AppIcon library="Ionicons" name="information-circle-outline" size={20} color={colors.accent} />
              <Text style={styles.infoText}>
                Manage your payment methods securely. All transactions are encrypted.
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textInverse,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  paymentCard: {
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  methodDetails: {
    flex: 1,
    marginLeft: 8,
  },
  methodType: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  methodLast: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  infoCard: {
    marginTop: 16,
    backgroundColor: colors.accent + "10",
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
  },
});

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import colors from "../utils/colors";
import Card from "../components/Card";
import AppIcon from "../components/common/AppIcon";

const TermsSection = ({ title, content }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.content}>{content}</Text>
  </View>
);

export default function TermsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <LinearGradient colors={colors.gradient.primary} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <AppIcon library="Ionicons" name="arrow-back" size={24} color={colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
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
          <Card style={styles.lastUpdated}>
            <Text style={styles.lastUpdatedText}>
              Last Updated: January 2026
            </Text>
          </Card>

          <TermsSection
            title="1. Acceptance of Terms"
            content="By accessing and using DeliveryPlus Driver app, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service."
          />

          <TermsSection
            title="2. Driver Responsibilities"
            content="As a delivery driver, you agree to: (a) Complete deliveries in a timely manner, (b) Maintain professional conduct, (c) Follow traffic rules and safety regulations, (d) Report any issues or damages immediately, (e) Keep vehicle in good condition."
          />

          <TermsSection
            title="3. Payment Terms"
            content="Payments are processed weekly based on completed deliveries. DeliveryPlus reserves the right to adjust rates. All payments are subject to tax withholding as per local regulations."
          />

          <TermsSection
            title="4. Termination"
            content="DeliveryPlus reserves the right to terminate your account if you violate these terms or engage in misconduct. You may also terminate your account at any time by contacting support."
          />

          <TermsSection
            title="5. Limitation of Liability"
            content="DeliveryPlus shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the app or any related service."
          />

          <TermsSection
            title="6. Changes to Terms"
            content="DeliveryPlus reserves the right to modify these terms at any time. Changes will be effective immediately upon posting to the app. Continued use of the app constitutes acceptance of any modifications."
          />

          <TermsSection
            title="7. Contact Us"
            content="For any questions about these Terms & Conditions, please contact us at support@deliveryplus.com or call +91-800-000-0000."
          />
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
  lastUpdated: {
    marginBottom: 20,
    backgroundColor: colors.primary + "15",
  },
  lastUpdatedText: {
    padding: 12,
    fontSize: 12,
    color: colors.primary,
    fontWeight: "500",
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  content: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

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

const PrivacySection = ({ title, content }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.content}>{content}</Text>
  </View>
);

export default function PrivacyScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <LinearGradient colors={colors.gradient.primary} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <AppIcon library="Ionicons" name="arrow-back" size={24} color={colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
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

          <PrivacySection
            title="1. Introduction"
            content="DeliveryPlus is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application."
          />

          <PrivacySection
            title="2. Information We Collect"
            content="We collect information you provide directly to us, such as name, phone number, email, vehicle details, and location data during deliveries. We also collect device information, usage data, and automatically generated analytics."
          />

          <PrivacySection
            title="3. How We Use Your Information"
            content="Your information is used to: (a) Provide and maintain our services, (b) Process payments, (c) Improve our app and services, (d) Communicate with you about updates, (e) Comply with legal obligations."
          />

          <PrivacySection
            title="4. Information Sharing"
            content="We do not sell, trade, or rent your personal information. We may share information with service providers, law enforcement when required, and with your consent in other circumstances."
          />

          <PrivacySection
            title="5. Data Security"
            content="We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction."
          />

          <PrivacySection
            title="6. Your Rights"
            content="You have the right to access, correct, or delete your personal information. You can also opt-out of promotional communications at any time by contacting us."
          />

          <PrivacySection
            title="7. Cookies and Tracking"
            content="Our app uses cookies and similar tracking technologies to enhance your experience. You can control cookie settings through your device preferences."
          />

          <PrivacySection
            title="8. Third-Party Links"
            content="Our app may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. Please review their privacy policies separately."
          />

          <PrivacySection
            title="9. Children's Privacy"
            content="Our app is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children under 18."
          />

          <PrivacySection
            title="10. Changes to Privacy Policy"
            content="We may update this Privacy Policy periodically. We will notify you of any significant changes by posting the updated policy and updating the 'Last Updated' date."
          />

          <PrivacySection
            title="11. Contact Us"
            content="If you have questions or concerns about our Privacy Policy, please contact us at privacy@deliveryplus.com or call +91-800-000-0000."
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

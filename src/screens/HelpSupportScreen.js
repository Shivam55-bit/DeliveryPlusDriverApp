import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import colors from "../utils/colors";
import AppIcon from "../components/common/AppIcon";
import Card from "../components/Card";

const SupportItem = ({ icon, title, description, action, onPress }) => (
  <Card onPress={onPress} style={styles.supportCard}>
    <View style={styles.supportContent}>
      <View style={[styles.supportIcon, { backgroundColor: colors.primary + "15" }]}>
        <AppIcon library="MaterialCommunityIcons" name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.supportText}>
        <Text style={styles.supportTitle}>{title}</Text>
        <Text style={styles.supportDesc}>{description}</Text>
      </View>
      <AppIcon library="Ionicons" name="chevron-forward" size={20} color={colors.textMuted} />
    </View>
  </Card>
);

const FAQItem = ({ question, answer, isOpen, onToggle }) => (
  <Card onPress={onToggle} style={styles.faqCard}>
    <View style={styles.faqHeader}>
      <Text style={styles.faqQuestion}>{question}</Text>
      <AppIcon
        library="Ionicons"
        name={isOpen ? "chevron-up" : "chevron-down"}
        size={20}
        color={colors.primary}
      />
    </View>
    {isOpen && <Text style={styles.faqAnswer}>{answer}</Text>}
  </Card>
);

export default function HelpSupportScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [openFAQs, setOpenFAQs] = useState({});

  const toggleFAQ = (id) => {
    setOpenFAQs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCall = () => {
    Linking.openURL("tel:+918000000000").catch(() => {
      console.log("Failed to make call");
    });
  };

  const handleEmail = () => {
    Linking.openURL("mailto:support@deliveryplus.com").catch(() => {
      console.log("Failed to open email");
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <LinearGradient colors={colors.gradient.primary} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <AppIcon library="Ionicons" name="arrow-back" size={24} color={colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help & Support</Text>
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
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <SupportItem
            icon="phone"
            title="Call Support"
            description="Available 24/7"
            onPress={handleCall}
          />
          <SupportItem
            icon="email"
            title="Email Support"
            description="support@deliveryplus.com"
            onPress={handleEmail}
          />
          <SupportItem
            icon="chat"
            title="Live Chat"
            description="Chat with support team"
            onPress={() => console.log("Live chat")}
          />

          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>
            Frequently Asked Questions
          </Text>
          <FAQItem
            id="faq1"
            question="How do I track my deliveries?"
            answer="You can track all your deliveries from the Home screen. The status updates in real-time as you complete each job."
            isOpen={openFAQs.faq1}
            onToggle={() => toggleFAQ("faq1")}
          />
          <FAQItem
            id="faq2"
            question="How are my earnings calculated?"
            answer="Earnings are calculated based on distance traveled, time spent, and number of deliveries completed. Check the Earnings screen for a detailed breakdown."
            isOpen={openFAQs.faq2}
            onToggle={() => toggleFAQ("faq2")}
          />
          <FAQItem
            id="faq3"
            question="Can I change my delivery area?"
            answer="Yes, you can request a service area change by contacting support. We'll process your request within 24 hours."
            isOpen={openFAQs.faq3}
            onToggle={() => toggleFAQ("faq3")}
          />
          <FAQItem
            id="faq4"
            question="What should I do if there's a delivery issue?"
            answer="Report the issue immediately using the 'Report Issue' button in the job details. Our team will investigate and respond within 2 hours."
            isOpen={openFAQs.faq4}
            onToggle={() => toggleFAQ("faq4")}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  supportCard: {
    marginBottom: 10,
  },
  supportContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  supportIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  supportText: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  supportDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  faqCard: {
    marginBottom: 10,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  faqAnswer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

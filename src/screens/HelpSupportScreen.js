import React, { memo, useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../components/common/AppIcon";

const THEME = {
  primaryDark: "#082F5B",
  primary: "#0B3B69",
  navy: "#0B2545",
  blue: "#134074",
  cyan: "#0077B6",
  accent: "#159DE3",
  background: "#F3F6FB",
  surface: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  textInverse: "#FFFFFF",
  border: "#E2E8F0",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
};

const FAQ_DATA = [
  {
    id: "faq1",
    category: "Deliveries",
    question: "How do I track and update my active deliveries?",
    answer:
      "When a delivery is assigned, tap on the job from the Home or Jobs screen. Use the 'Start Job' button to begin transit. Location tracking activates automatically to provide real-time updates to dispatch and customers.",
  },
  {
    id: "faq2",
    category: "Earnings",
    question: "How are driver earnings and rates calculated?",
    answer:
      "Earnings are computed based on distance traveled, estimated transit duration, vehicle category rates, and completed milestones. Live earnings are recorded after job completion and deposited into your registered bank account weekly.",
  },
  {
    id: "faq3",
    category: "Deliveries",
    question: "What should I do if a customer is unavailable or address is wrong?",
    answer:
      "Attempt calling the customer via the in-app call button. If unreachable after 5 minutes, tap 'Report Issue' on the Job Details screen and inform Dispatch. Do not leave unattended packages without written authorization.",
  },
  {
    id: "faq4",
    category: "Vehicle & App",
    question: "How do I get an assigned vehicle or update vehicle details?",
    answer:
      "Vehicles are assigned by your fleet dispatcher or administrator. To assign or change a vehicle, contact dispatch via the 'Call Dispatch' or 'Vehicle Details' screen with your registration and licence details.",
  },
  {
    id: "faq5",
    category: "Deliveries",
    question: "Can I change my preferred delivery area or zones?",
    answer:
      "Yes. You can request a preferred operating zone update through Dispatch or by emailing info@deliveryplus.com.au. Zone adjustments are typically reviewed and activated within 24 hours.",
  },
  {
    id: "faq6",
    category: "Vehicle & App",
    question: "What if the app loses GPS or internet connection mid-delivery?",
    answer:
      "DeliveryPlus Driver App stores job progress and completion proofs locally when offline. As soon as cellular connection is restored, pending milestone updates and uploaded signatures will sync automatically.",
  },
];

const ContactChannel = memo(
  ({ icon, title, subtitle, badgeText, badgeColor = THEME.success, onPress, iconBg = "#E0F2FE", iconColor = THEME.cyan }) => (
    <TouchableOpacity
      style={styles.channelCard}
      onPress={onPress}
      activeOpacity={0.84}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.channelIconWrap, { backgroundColor: iconBg }]}>
        <AppIcon library="MaterialCommunityIcons" name={icon} size={24} color={iconColor} />
      </View>

      <View style={styles.channelCopy}>
        <View style={styles.channelTitleRow}>
          <Text style={styles.channelTitle}>{title}</Text>
          {badgeText ? (
            <View style={[styles.statusPill, { backgroundColor: `${badgeColor}15` }]}>
              <View style={[styles.statusDot, { backgroundColor: badgeColor }]} />
              <Text style={[styles.statusText, { color: badgeColor }]}>{badgeText}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.channelSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <AppIcon library="Feather" name="chevron-right" size={20} color={THEME.textMuted} />
    </TouchableOpacity>
  )
);

const FAQCard = memo(({ item, isOpen, onToggle }) => (
  <View style={styles.faqCard}>
    <TouchableOpacity
      style={styles.faqHeader}
      onPress={onToggle}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={item.question}
    >
      <Text style={styles.faqQuestion}>{item.question}</Text>
      <View style={styles.faqChevronWrap}>
        <AppIcon
          library="Feather"
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={18}
          color={THEME.primary}
        />
      </View>
    </TouchableOpacity>

    {isOpen ? (
      <View style={styles.faqAnswerContainer}>
        <Text style={styles.faqAnswer}>{item.answer}</Text>
      </View>
    ) : null}
  </View>
));

export default function HelpSupportScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [openFAQs, setOpenFAQs] = useState({ faq1: true });
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [ticketTopic, setTicketTopic] = useState("Active Delivery Issue");
  const [ticketMessage, setTicketMessage] = useState("");
  const [sendingTicket, setSendingTicket] = useState(false);

  const toggleFAQ = useCallback((id) => {
    setOpenFAQs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleCallSupport = () => {
    Alert.alert(
      "Call Dispatch Support",
      "Connect directly with the 24/7 DeliveryPlus driver dispatch team?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Hotline",
          onPress: () => {
            Linking.openURL("tel:+61424796524").catch(() => {
              Alert.alert(
                "Phone Client Unavailable",
                "Support phone line: +61 424 796 524"
              );
            });
          },
        },
      ]
    );
  };

  const handleEmailSupport = () => {
    const subject = encodeURIComponent("DeliveryPlus Driver Support Request");
    const body = encodeURIComponent(
      "Hello DeliveryPlus Support,\n\nI need assistance with:\n\n[Please describe your issue here]\n\n"
    );
    Linking.openURL(
      `mailto:info@deliveryplus.com.au?subject=${subject}&body=${body}`
    ).catch(() => {
      Alert.alert(
        "Email Client Unavailable",
        "Please send an email directly to info@deliveryplus.com.au"
      );
    });
  };

  const handleOpenWhatsApp = () => {
    const message = encodeURIComponent(
      "Hi DeliveryPlus Support, I am an active driver and need assistance with my deliveries."
    );
    Linking.openURL(`https://wa.me/61424796524?text=${message}`).catch(() => {
      Alert.alert(
        "WhatsApp Not Installed",
        "Please reach out via Phone (+61 424 796 524) or Email (info@deliveryplus.com.au)."
      );
    });
  };

  const handleOpenWebsite = () => {
    Linking.openURL("https://www.deliveryplus.com.au").catch(() => {
      Alert.alert("Notice", "Visit our website: https://www.deliveryplus.com.au");
    });
  };

  const handleSendTicket = () => {
    if (!ticketMessage.trim()) {
      Alert.alert("Message Required", "Please enter a brief description of your issue.");
      return;
    }

    setSendingTicket(true);
    setTimeout(() => {
      setSendingTicket(false);
      setChatModalVisible(false);
      setTicketMessage("");
      Alert.alert(
        "Support Ticket Created",
        "Your message has been dispatched to our operations team. A support agent will contact you shortly.",
        [{ text: "OK" }]
      );
    }, 800);
  };

  const categories = ["All", "Deliveries", "Earnings", "Vehicle & App"];

  const filteredFAQs =
    selectedCategory === "All"
      ? FAQ_DATA
      : FAQ_DATA.filter((item) => item.category === selectedCategory);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Simple Header */}
      <View
        style={[
          styles.simpleHeader,
          { paddingTop: Math.max(insets.top, 10) },
        ]}
      >
        {insets.top <= 20 ? <View style={styles.sheetHandle} /> : null}

        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("Home");
              }
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <AppIcon library="Ionicons" name="chevron-back" size={22} color={THEME.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Help & Support
          </Text>

          <View style={styles.headerActionPlaceholder} />
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 36 },
        ]}
      >
        <View style={styles.statusBanner}>
          <View style={styles.statusDotLive} />
          <Text style={styles.statusBannerText}>Dispatch System: Operational • Avg Response &lt; 2m</Text>
        </View>
        {/* Urgent Emergency Alert Banner */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyIconWrap}>
            <AppIcon library="MaterialCommunityIcons" name="alert-decagram" size={24} color={THEME.danger} />
          </View>
          <View style={styles.emergencyCopy}>
            <Text style={styles.emergencyTitle}>Road or Safety Emergency?</Text>
            <Text style={styles.emergencyText}>
              For urgent accidents or cargo emergencies, dial 000 immediately or tap to call dispatch.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.emergencyCallBtn}
            onPress={handleCallSupport}
            activeOpacity={0.84}
          >
            <Text style={styles.emergencyCallBtnText}>Call Now</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Channels Section */}
        <Text style={styles.sectionHeaderTitle}>Direct Contact Channels</Text>
        <View style={styles.channelsContainer}>
          <ContactChannel
            icon="phone-in-talk"
            title="Call Support Hotline"
            subtitle="+61 424 796 524 • Direct line for active deliveries"
            badgeText="Available 24/7"
            badgeColor={THEME.success}
            iconBg="#DCFCE7"
            iconColor={THEME.success}
            onPress={handleCallSupport}
          />

          <ContactChannel
            icon="chat-processing-outline"
            title="Live Chat & Quick Help"
            subtitle="Chat via WhatsApp (+61 424 796 524) or send message"
            badgeText="Online"
            badgeColor={THEME.cyan}
            iconBg="#E0F2FE"
            iconColor={THEME.cyan}
            onPress={() => setChatModalVisible(true)}
          />

          <ContactChannel
            icon="email-outline"
            title="Email Driver Support"
            subtitle="info@deliveryplus.com.au • For payout, account or inquiries"
            badgeText="Reply &lt; 2h"
            badgeColor={THEME.warning}
            iconBg="#FEF3C7"
            iconColor={THEME.warning}
            onPress={handleEmailSupport}
          />

          <ContactChannel
            icon="web"
            title="Official Website"
            subtitle="www.deliveryplus.com.au • Terms, policies & info"
            badgeText="Visit Web"
            badgeColor={THEME.primary}
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
            onPress={handleOpenWebsite}
          />
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Frequently Asked Questions</Text>
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillRow}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  isSelected && styles.categoryPillSelected,
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected && styles.categoryPillTextSelected,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* FAQ Accordion Items */}
        <View style={styles.faqList}>
          {filteredFAQs.map((item) => (
            <FAQCard
              key={item.id}
              item={item}
              isOpen={Boolean(openFAQs[item.id])}
              onToggle={() => toggleFAQ(item.id)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Interactive Support Modal */}
      <Modal
        visible={chatModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setChatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 20) + 12 },
            ]}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Driver Live Assistance</Text>
                <Text style={styles.modalSubtitle}>Select how you would like to connect</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setChatModalVisible(false)}
              >
                <AppIcon library="Ionicons" name="close" size={20} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Quick Option 1: WhatsApp */}
            <TouchableOpacity
              style={styles.whatsappOptionBtn}
              onPress={handleOpenWhatsApp}
              activeOpacity={0.86}
            >
              <View style={styles.whatsappIconCircle}>
                <AppIcon library="MaterialCommunityIcons" name="whatsapp" size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.whatsappOptionTitle}>Chat on WhatsApp</Text>
                <Text style={styles.whatsappOptionSubtitle}>Instant responses from active dispatchers</Text>
              </View>
              <AppIcon library="Feather" name="external-link" size={18} color="#25D366" />
            </TouchableOpacity>

            {/* In-App Message Option */}
            <View style={styles.ticketSection}>
              <Text style={styles.ticketSectionTitle}>Or Send In-App Message:</Text>

              {/* Topic Selector */}
              <View style={styles.topicRow}>
                {["Active Delivery Issue", "Earnings", "Other"].map((topic) => (
                  <TouchableOpacity
                    key={topic}
                    style={[
                      styles.topicPill,
                      ticketTopic === topic && styles.topicPillActive,
                    ]}
                    onPress={() => setTicketTopic(topic)}
                  >
                    <Text
                      style={[
                        styles.topicPillText,
                        ticketTopic === topic && styles.topicPillTextActive,
                      ]}
                    >
                      {topic}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.ticketInput}
                placeholder="Describe your question or issue in detail..."
                placeholderTextColor={THEME.textMuted}
                multiline
                numberOfLines={3}
                value={ticketMessage}
                onChangeText={setTicketMessage}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.sendTicketBtn}
                onPress={handleSendTicket}
                activeOpacity={0.86}
                disabled={sendingTicket}
              >
                <AppIcon
                  library="MaterialCommunityIcons"
                  name={sendingTicket ? "loading" : "send"}
                  size={18}
                  color={THEME.textInverse}
                />
                <Text style={styles.sendTicketBtnText}>
                  {sendingTicket ? "Dispatching..." : "Submit Support Message"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  simpleHeader: {
    backgroundColor: THEME.surface,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
  headerActionPlaceholder: {
    width: 38,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 14,
    alignSelf: "center",
  },
  statusDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.success,
  },
  statusBannerText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 20,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  emergencyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyCopy: {
    flex: 1,
  },
  emergencyTitle: {
    color: "#991B1B",
    fontSize: 13.5,
    fontWeight: "800",
  },
  emergencyText: {
    color: "#B91C1C",
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  emergencyCallBtn: {
    backgroundColor: THEME.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emergencyCallBtnText: {
    color: THEME.textInverse,
    fontSize: 12,
    fontWeight: "800",
  },
  sectionHeaderTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },
  channelsContainer: {
    gap: 10,
    marginBottom: 24,
  },
  channelCard: {
    backgroundColor: THEME.surface,
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  channelIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  channelCopy: {
    flex: 1,
  },
  channelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  channelTitle: {
    color: THEME.text,
    fontSize: 14.5,
    fontWeight: "800",
  },
  channelSubtitle: {
    color: THEME.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  faqSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  categoryPillRow: {
    gap: 8,
    paddingBottom: 14,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  categoryPillSelected: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  categoryPillText: {
    color: THEME.textSecondary,
    fontSize: 12.5,
    fontWeight: "700",
  },
  categoryPillTextSelected: {
    color: THEME.textInverse,
  },
  faqList: {
    gap: 10,
  },
  faqCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    gap: 10,
  },
  faqQuestion: {
    flex: 1,
    color: THEME.text,
    fontSize: 13.5,
    fontWeight: "700",
    lineHeight: 19,
  },
  faqChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  faqAnswerContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FAFCFF",
  },
  faqAnswer: {
    color: THEME.textSecondary,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: THEME.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    color: THEME.text,
    fontSize: 17,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: THEME.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  whatsappOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    padding: 14,
    borderRadius: 16,
    marginBottom: 18,
  },
  whatsappIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  whatsappOptionTitle: {
    color: "#14532D",
    fontSize: 14.5,
    fontWeight: "800",
  },
  whatsappOptionSubtitle: {
    color: "#166534",
    fontSize: 12,
    marginTop: 2,
  },
  ticketSection: {
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    paddingTop: 16,
  },
  ticketSectionTitle: {
    color: THEME.text,
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 10,
  },
  topicRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  topicPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  topicPillActive: {
    backgroundColor: THEME.primary,
  },
  topicPillText: {
    color: THEME.textSecondary,
    fontSize: 11.5,
    fontWeight: "600",
  },
  topicPillTextActive: {
    color: THEME.textInverse,
    fontWeight: "700",
  },
  ticketInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    color: THEME.text,
    minHeight: 80,
    marginBottom: 14,
  },
  sendTicketBtn: {
    backgroundColor: THEME.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  sendTicketBtnText: {
    color: THEME.textInverse,
    fontSize: 13.5,
    fontWeight: "800",
  },
});

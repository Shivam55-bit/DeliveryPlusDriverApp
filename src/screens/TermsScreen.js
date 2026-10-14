import React, { memo } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
};

const TERMS_POINTS = [
  {
    id: "safe_driving",
    number: "1",
    title: "Safe Driving & Compliance",
    icon: "shield-check-outline",
    iconColor: "#0077B6",
    iconBg: "#E0F2FE",
    content:
      "Drivers must strictly comply with Australian road rules, speed limits, and fatigue management regulations. Safe transit of cargo and passenger safety is our top priority.",
  },
  {
    id: "timely_milestones",
    number: "2",
    title: "Timely Delivery & Proof of Delivery",
    icon: "clock-check-outline",
    iconColor: "#16A34A",
    iconBg: "#DCFCE7",
    content:
      "Accept and execute assigned delivery shifts punctually. Promptly update job status (Pickup, In-Transit, Delivered) and obtain valid customer signatures or delivery photos.",
  },
  {
    id: "payouts",
    number: "3",
    title: "Transparent Rates & Weekly Payouts",
    icon: "cash-multiple",
    iconColor: "#D97706",
    iconBg: "#FEF3C7",
    content:
      "Driver earnings are transparently calculated per delivery milestone and distance. Weekly payouts are transferred directly into your nominated Australian bank account.",
  },
  {
    id: "vehicle",
    number: "4",
    title: "Vehicle Roadworthiness & Insurance",
    icon: "truck-check-outline",
    iconColor: "#7C3AED",
    iconBg: "#EDE9FE",
    content:
      "Vehicles must remain clean, roadworthy, and covered with required Compulsory Third-Party (CTP) and commercial transit insurance throughout active delivery shifts.",
  },
  {
    id: "conduct",
    number: "5",
    title: "Professional Conduct & Reliability",
    icon: "handshake-outline",
    iconColor: "#0284C7",
    iconBg: "#E0F2FE",
    content:
      "Maintain respectful and professional interactions with merchants, consignees, and dispatchers. Report any delays or vehicle breakdowns immediately to dispatch.",
  },
  {
    id: "governing_law",
    number: "6",
    title: "Governing Law & Legal Terms",
    icon: "scale-balance",
    iconColor: "#475569",
    iconBg: "#F1F5F9",
    content:
      "All driver agreements and operations are governed under Australian Commonwealth and State transport legislation. Complete legal details can be reviewed online.",
  },
];

const PointCard = memo(({ item }) => (
  <View style={styles.pointCard}>
    <View style={styles.pointCardHeader}>
      <View style={[styles.pointIconWrap, { backgroundColor: item.iconBg }]}>
        <AppIcon
          library="MaterialCommunityIcons"
          name={item.icon}
          size={22}
          color={item.iconColor}
        />
      </View>
      <View style={styles.pointHeaderCopy}>
        <Text style={styles.pointNumber}>POINT {item.number}</Text>
        <Text style={styles.pointTitle}>{item.title}</Text>
      </View>
    </View>
    <Text style={styles.pointContent}>{item.content}</Text>
  </View>
));

export default function TermsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleOpenWebsite = () => {
    Linking.openURL("https://www.deliveryplus.com.au").catch(() => {
      Alert.alert("Notice", "Visit our website: https://www.deliveryplus.com.au");
    });
  };

  const handleContactEmail = () => {
    Linking.openURL(
      "mailto:info@deliveryplus.com.au?subject=DeliveryPlus%20Driver%20Terms%20Inquiry"
    ).catch(() => {
      Alert.alert(
        "Email Client Unavailable",
        "Please send an email to info@deliveryplus.com.au"
      );
    });
  };

  const handleContactCall = () => {
    Alert.alert(
      "Contact Support",
      "Would you like to call DeliveryPlus Driver Support now?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Support",
          onPress: () => {
            Linking.openURL("tel:+61424796524").catch(() => {
              Alert.alert("Notice", "Support line: +61 424 796 524");
            });
          },
        },
      ]
    );
  };

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
            <AppIcon
              library="Ionicons"
              name="chevron-back"
              size={22}
              color={THEME.text}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Terms & Conditions
          </Text>

          <View style={styles.headerActionPlaceholder} />
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 36 },
        ]}
      >
        <View style={styles.badgeRow}>
          <View style={styles.updatedBadge}>
            <AppIcon
              library="MaterialCommunityIcons"
              name="calendar-clock"
              size={14}
              color={THEME.primary}
            />
            <Text style={styles.updatedBadgeText}>
              Official Policy • deliveryplus.com.au
            </Text>
          </View>
        </View>

        {/* Website Action Banner */}
        <View style={styles.websiteBannerCard}>
          <View style={styles.websiteBannerHeader}>
            <View style={styles.websiteBannerIconWrap}>
              <AppIcon
                library="MaterialCommunityIcons"
                name="web"
                size={24}
                color={THEME.primary}
              />
            </View>
            <View style={styles.websiteBannerCopy}>
              <Text style={styles.websiteBannerTitle}>Read Full Terms on Website</Text>
              <Text style={styles.websiteBannerSubtitle}>
                Aap detailed Terms & Conditions hamari official website par read kar sakte hain. Kisi bhi query ke liye support team se contact karein.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.websiteButton}
            activeOpacity={0.86}
            onPress={handleOpenWebsite}
          >
            <AppIcon
              library="Feather"
              name="external-link"
              size={16}
              color={THEME.textInverse}
            />
            <Text style={styles.websiteButtonText}>Open www.deliveryplus.com.au</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Driver Principles Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Key Driver Terms & Guidelines</Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Important summary points for active driver partners
          </Text>
        </View>

        {/* Points List */}
        <View style={styles.pointsContainer}>
          {TERMS_POINTS.map((item) => (
            <PointCard key={item.id} item={item} />
          ))}
        </View>

        {/* Contact Support Footer */}
        <View style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <View style={styles.contactIconWrap}>
              <AppIcon
                library="MaterialCommunityIcons"
                name="help-circle-outline"
                size={24}
                color={THEME.primary}
              />
            </View>
            <View style={styles.contactCopy}>
              <Text style={styles.contactTitle}>Have questions or queries?</Text>
              <Text style={styles.contactSubtitle}>
                Agar koi bhi query ho to hamari driver support team se direct contact karein.
              </Text>
            </View>
          </View>

          <View style={styles.contactButtonsRow}>
            <TouchableOpacity
              style={styles.contactBtnPrimary}
              onPress={handleContactEmail}
              activeOpacity={0.86}
            >
              <AppIcon
                library="MaterialCommunityIcons"
                name="email-outline"
                size={18}
                color={THEME.textInverse}
              />
              <Text style={styles.contactBtnPrimaryText}>Email Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactBtnOutline}
              onPress={handleContactCall}
              activeOpacity={0.86}
            >
              <AppIcon
                library="MaterialCommunityIcons"
                name="phone-outline"
                size={18}
                color={THEME.primary}
              />
              <Text style={styles.contactBtnOutlineText}>Call Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  badgeRow: {
    alignItems: "center",
    marginBottom: 14,
  },
  updatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  updatedBadgeText: {
    color: THEME.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  websiteBannerCard: {
    backgroundColor: THEME.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  websiteBannerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  websiteBannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  websiteBannerCopy: {
    flex: 1,
  },
  websiteBannerTitle: {
    color: THEME.primary,
    fontSize: 15.5,
    fontWeight: "800",
  },
  websiteBannerSubtitle: {
    color: THEME.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  websiteButton: {
    backgroundColor: THEME.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  websiteButtonText: {
    color: THEME.textInverse,
    fontSize: 13.5,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    color: THEME.text,
    fontSize: 15,
    fontWeight: "800",
  },
  sectionHeaderSubtitle: {
    color: THEME.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  pointsContainer: {
    gap: 10,
    marginBottom: 18,
  },
  pointCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  pointCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  pointIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pointHeaderCopy: {
    flex: 1,
  },
  pointNumber: {
    color: THEME.cyan,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  pointTitle: {
    color: THEME.text,
    fontSize: 14.5,
    fontWeight: "700",
    marginTop: 1,
  },
  pointContent: {
    color: THEME.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "400",
  },
  contactCard: {
    backgroundColor: THEME.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 20,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  contactIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  contactCopy: {
    flex: 1,
  },
  contactTitle: {
    color: THEME.text,
    fontSize: 14.5,
    fontWeight: "700",
  },
  contactSubtitle: {
    color: THEME.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  contactButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  contactBtnPrimary: {
    flex: 1,
    backgroundColor: THEME.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  contactBtnPrimaryText: {
    color: THEME.textInverse,
    fontSize: 13,
    fontWeight: "700",
  },
  contactBtnOutline: {
    flex: 1,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  contactBtnOutlineText: {
    color: THEME.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});

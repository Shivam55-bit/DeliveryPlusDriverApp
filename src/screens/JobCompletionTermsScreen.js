import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import API from "../services/api";
import AppIcon from "../components/common/AppIcon";

export default function JobCompletionTermsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const jobId = route?.params?.jobId;
  const job = route?.params?.job || {};

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [stairsAtProperty, setStairsAtProperty] = useState(null);
  const [stairsWaiverAccepted, setStairsWaiverAccepted] = useState(false);
  const [customerSignatureName, setCustomerSignatureName] = useState(job.customerName || "");
  const [customerSignatureDate, setCustomerSignatureDate] = useState(
    new Date().toLocaleDateString("en-US")
  );
  const [driverName, setDriverName] = useState("");
  const [driverProfileName, setDriverProfileName] = useState("");

  const jobReference =
    job.jobReference || job.jobNumber || job.referenceNumber || job.id || "N/A";
  const jobTypeLabel =
    job.jobTypeLabel || job.jobType || job.type || job.serviceType || "Job";


  useEffect(() => {
    const fetchDriverProfile = async () => {
      try {
        const response = await API.get("/auth/me");
        const profile = response?.user ?? response?.data ?? response;
        const name =
          profile?.name || profile?.fullName || profile?.driverName || "";
        if (name) setDriverProfileName(name);
      } catch (error) {
        // ignore profile fetch failures; driver can still enter name manually
      }
    };

    fetchDriverProfile();
  }, []);


  const handleTermsScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (
      !termsScrolledToBottom &&
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 12
    ) {
      setTermsScrolledToBottom(true);
    }
  };

  const handleContinue = () => {
    if (!jobId) {
      Alert.alert("Missing Job", "Unable to continue without a job reference.");
      return;
    }

    if (!termsScrolledToBottom) {
      Alert.alert(
        "Read the agreement",
        "Please scroll the full agreement before continuing."
      );
      return;
    }

    if (!termsAccepted) {
      Alert.alert(
        "Terms required",
        "Please confirm the customer has agreed to the completion terms."
      );
      return;
    }

    if (!deliveryConfirmed) {
      Alert.alert(
        "Delivery confirmation",
        "Please confirm the delivery has been completed with the customer."
      );
      return;
    }

    if (stairsAtProperty === null) {
      Alert.alert(
        "Stairs acknowledgement",
        "Please indicate whether stairs were involved at the delivery location."
      );
      return;
    }

    if (stairsAtProperty === "yes" && !stairsWaiverAccepted) {
      Alert.alert(
        "Waiver required",
        "Please accept the stairs waiver before continuing."
      );
      return;
    }

    if (!customerSignatureName.trim()) {
      Alert.alert(
        "Customer name required",
        "Please enter the customer name as it appears on the sign-off."
      );
      return;
    }

    if (!customerSignatureDate.trim()) {
      Alert.alert(
        "Signature date required",
        "Please enter the signature date."
      );
      return;
    }

    if (!driverName.trim() && !driverProfileName.trim()) {
      Alert.alert("Driver name required", "Please enter your name before continuing.");
      return;
    }

    navigation.navigate("Signature", {
      type: "complete",
      jobId,
      job,
      termsAccepted: true,
      termsReadAt: new Date().toISOString(),
      deliveryConfirmed,
      stairsAtProperty,
      stairsWaiverAccepted,
      customerSignatureName: customerSignatureName.trim(),
      customerSignatureDate: customerSignatureDate.trim(),
      driverName: driverName.trim() || driverProfileName.trim(),
    });
  };

  const isContinueReady =
    termsScrolledToBottom &&
    termsAccepted &&
    deliveryConfirmed &&
    stairsAtProperty !== null &&
    (stairsAtProperty === "no" || stairsWaiverAccepted) &&
    !!customerSignatureName.trim() &&
    !!customerSignatureDate.trim() &&
    !!driverName.trim();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2545" />

      <View style={styles.headerWrap}>
        <LinearGradient
          colors={["#0B2545", "#134074", "#0077B6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 16) + 12 }]}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon library="Ionicons" name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Job Completion Terms</Text>
            <View style={styles.headerRightSpacer} />
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Job summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Job:</Text>
            <Text style={styles.summaryValue}>{jobReference}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Customer:</Text>
            <Text style={styles.summaryValue}>{job.customerName || "Unknown"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service:</Text>
            <Text style={styles.summaryValue}>{jobTypeLabel}</Text>
          </View>
          {(job.pickupAddress || job.pickup) ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pickup:</Text>
              <Text style={styles.summaryValue}>{job.pickupAddress || job.pickup}</Text>
            </View>
          ) : null}
          {(job.dropoffAddress || job.drop || job.dropAddress) ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Drop-off:</Text>
              <Text style={styles.summaryValue}>{job.dropoffAddress || job.dropAddress || job.drop}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Agreement & delivery terms</Text>
          <Text style={styles.cardSub}>
            Scroll to the bottom to confirm the customer has read the full agreement.
          </Text>

          <View style={styles.termsTextWrap}>
            <ScrollView
              nestedScrollEnabled
              onScroll={handleTermsScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.termsTextContent}
              style={styles.termsTextScroll}
            >
              <Text style={styles.termsParagraph}>1. PAYMENT</Text>
              <Text style={styles.termsParagraph}>
                All payments must be made via Cash, EFTPOS, or cleared Bank Transfer before or upon pickup. No work will commence without payment confirmation.
              </Text>

              <Text style={styles.termsParagraph}>2. CLAIMS & COMPLAINTS</Text>
              <Text style={styles.termsParagraph}>
                No claims will be entertained once the driver has left the pickup or delivery address. Any issues must be reported before departure.
              </Text>

              <Text style={styles.termsParagraph}>3. FRAGILE ITEMS & CUSTOMER-PACKED BOXES</Text>
              <Text style={styles.termsParagraph}>
                Delivery Plus Australia Pty Ltd accepts no responsibility for fragile or loose items including glassware, mirrors, electronics, artwork, or goods packed by the customer.
              </Text>

              <Text style={styles.termsParagraph}>4. STAIRS & TOLLS</Text>
              <Text style={styles.termsParagraph}>
                All toll charges and stair-related access fees are payable by the customer unless otherwise stated in the quotation.
              </Text>

              <Text style={styles.termsParagraph}>5. HARD ACCESS PROPERTIES</Text>
              <Text style={styles.termsParagraph}>
                Additional charges may apply where property access is considered difficult, including:{"\n"}• Truck parked more than 30 metres from entrance{"\n"}• Steep driveways{"\n"}• Narrow access{"\n"}• Difficult pathways{"\n"}• Long carrying distance
              </Text>

              <Text style={styles.termsParagraph}>6. CUBIC METRE LIMIT</Text>
              <Text style={styles.termsParagraph}>
                Customers are allocated the truck space quoted in their booking. Loads exceeding the quoted cubic metre allowance may incur additional charges or require another delivery trip.
              </Text>

              <Text style={styles.termsParagraph}>7. TVs, ELECTRONICS & FRAGILE GOODS</Text>
              <Text style={styles.termsParagraph}>
                Please refer to the detailed Terms & Conditions document provided in your booking confirmation email regarding coverage and limitations for TVs, electronics, glass items, mirrors, artwork and other fragile goods.
              </Text>

              <Text style={styles.termsParagraph}>8. PROPERTY ACCESS & DAMAGE WAIVER</Text>
              <Text style={styles.termsParagraph}>
                Are there stairs at the property?
              </Text>
              <Text style={styles.termsParagraph}>
                YES — I understand and accept that Delivery Plus Australia Pty Ltd is not liable for any damage caused to walls, floors, ceilings, staircases, or similar areas associated with moving items up or down stairs.
              </Text>
              <Text style={styles.termsParagraph}>
                NO — I confirm that the goods have been received in acceptable condition unless otherwise noted before the delivery team leaves.
              </Text>
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[styles.checkboxRow, !termsScrolledToBottom && styles.checkboxDisabled]}
            onPress={() => {
              if (!termsScrolledToBottom) return;
              setTermsAccepted(!termsAccepted);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
              {termsAccepted ? (
                <AppIcon library="Ionicons" name="checkmark" size={16} color="#FFF" />
              ) : null}
            </View>
            <Text style={styles.checkboxLabel}>
              Customer has read and agrees to the full delivery terms.
            </Text>
          </TouchableOpacity>
          {!termsScrolledToBottom ? (
            <Text style={styles.hintText}>
              Scroll to the bottom of the agreement to enable acceptance.
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Acknowledgements</Text>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setDeliveryConfirmed(!deliveryConfirmed)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, deliveryConfirmed && styles.checkboxActive]}>
              {deliveryConfirmed ? (
                <AppIcon library="Ionicons" name="checkmark" size={16} color="#FFF" />
              ) : null}
            </View>
            <Text style={styles.checkboxLabel}>
              Delivery has been completed and confirmed with the customer.
            </Text>
          </TouchableOpacity>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Were stairs involved at the delivery property?</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[styles.radioOption, stairsAtProperty === "yes" && styles.radioOptionActive]}
              onPress={() => setStairsAtProperty("yes")}
              activeOpacity={0.8}
            >
              <Text style={styles.radioText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioOption, stairsAtProperty === "no" && styles.radioOptionActive]}
              onPress={() => setStairsAtProperty("no")}
              activeOpacity={0.8}
            >
              <Text style={styles.radioText}>No</Text>
            </TouchableOpacity>
          </View>

          {stairsAtProperty === "yes" ? (
            <TouchableOpacity
              style={[styles.checkboxRow, { marginTop: 16 }]}
              onPress={() => setStairsWaiverAccepted(!stairsWaiverAccepted)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, stairsWaiverAccepted && styles.checkboxActive]}>
                {stairsWaiverAccepted ? (
                  <AppIcon library="Ionicons" name="checkmark" size={16} color="#FFF" />
                ) : null}
              </View>
              <Text style={styles.checkboxLabel}>
                Customer accepts the stairs waiver and additional handling acknowledgement.
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signature details</Text>
          <Text style={styles.cardSub}>
            Capture the customer name, date, and driver name for this completion.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Customer Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Customer name as printed"
              placeholderTextColor="#94A3B8"
              value={customerSignatureName}
              onChangeText={setCustomerSignatureName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Signature Date</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#94A3B8"
              value={customerSignatureDate}
              onChangeText={setCustomerSignatureDate}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Driver Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Driver name"
              placeholderTextColor="#94A3B8"
              value={driverName || driverProfileName}
              onChangeText={setDriverName}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, !isContinueReady && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!isContinueReady}
          activeOpacity={0.8}
        >
          <Text style={styles.continueBtnText}>Continue to Signature</Text>
          <AppIcon library="Ionicons" name="arrow-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F6FA",
  },
  headerWrap: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  headerRightSpacer: {
    width: 36,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 10,
    textAlign: "left",
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "rgba(15, 23, 42, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  cardSub: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  summaryLabel: {
    width: 92,
    fontSize: 13,
    color: "#475569",
    fontWeight: "700",
  },
  summaryValue: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  termsTextWrap: {
    height: 240,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },
  termsTextScroll: {
    flex: 1,
  },
  termsTextContent: {
    padding: 14,
  },
  termsParagraph: {
    fontSize: 13,
    lineHeight: 20,
    color: "#334155",
    marginBottom: 14,
  },
  hintText: {
    marginTop: 10,
    fontSize: 12,
    color: "#64748B",
  },
  fieldLabel: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "700",
    marginBottom: 8,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  radioGroup: {
    flexDirection: "row",
    gap: 12,
  },
  radioOption: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  radioOptionActive: {
    borderColor: "#0B2545",
    backgroundColor: "#EFF6FF",
  },
  radioText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  checkboxActive: {
    backgroundColor: "#0B2545",
    borderColor: "#0B2545",
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  signatureHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  signedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  signedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0B2545",
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 8,
  },
  continueBtnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFF",
  },
});

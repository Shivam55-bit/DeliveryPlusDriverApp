import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  StatusBar,
  ActivityIndicator,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import API, { clearAuthToken, getStoredUser } from "../services/api";
import AppIcon from "../components/common/AppIcon";
import { normalizeJob } from "../utils/jobHelpers";

export default function StartJobAgreementScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const jobId =
    route?.params?.jobId || route?.params?.job?._id || route?.params?.job?.id;
  const job = route?.params?.job || {};

  // Form State
  const initialCustomerName =
    route?.params?.customerSignatureName ||
    route?.params?.customerName ||
    job?.customerName ||
    job?.customer?.name ||
    "";

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(
    Boolean(route?.params?.hasScrolledToBottom)
  );
  const [stairsOption, setStairsOption] = useState(
    route?.params?.stairsOption ?? null
  ); // 'yes' | 'no' | null
  const [termsAccepted, setTermsAccepted] = useState(
    Boolean(route?.params?.termsAccepted)
  );
  const [customerSignatureName, setCustomerSignatureName] =
    useState(initialCustomerName);
  const [customerSignature, setCustomerSignature] = useState(
    route?.params?.customerSignature || null
  );
  const [submitting, setSubmitting] = useState(false);

  // Sync when returning from SignatureScreen
  useEffect(() => {
    if (route?.params?.customerSignature) {
      setCustomerSignature(route.params.customerSignature);
    }
    if (route?.params?.customerSignatureName) {
      setCustomerSignatureName(route.params.customerSignatureName);
    } else if (route?.params?.customerName) {
      setCustomerSignatureName(route.params.customerName);
    }
    if (route?.params?.hasScrolledToBottom !== undefined) {
      setHasScrolledToBottom(Boolean(route.params.hasScrolledToBottom));
    }
    if (route?.params?.termsAccepted !== undefined) {
      setTermsAccepted(Boolean(route.params.termsAccepted));
    }
    if (route?.params?.stairsOption !== undefined && route.params.stairsOption !== null) {
      setStairsOption(route.params.stairsOption);
    }
  }, [
    route?.params?.customerSignature,
    route?.params?.customerSignatureName,
    route?.params?.customerName,
    route?.params?.hasScrolledToBottom,
    route?.params?.termsAccepted,
    route?.params?.stairsOption,
  ]);

  const jobReference =
    job.jobReference ||
    job.jobNumber ||
    job.referenceNumber ||
    job._id ||
    job.id ||
    jobId ||
    "N/A";
  const jobTypeLabel =
    job.jobTypeLabel || job.jobType || job.type || job.serviceType || "Job";

  const handleTermsScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (
      !hasScrolledToBottom &&
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 15
    ) {
      setHasScrolledToBottom(true);
    }
  };

  const handleOpenSignatureScreen = () => {
    navigation.navigate("Signature", {
      type: "start",
      returnScreen: "StartJobAgreement",
      jobId,
      job,
      hasScrolledToBottom,
      termsAccepted,
      stairsOption,
      customerSignatureName: customerSignatureName.trim(),
      customerName: customerSignatureName.trim(),
      onSignatureSaved: (sigBase64, name) => {
        setCustomerSignature(sigBase64);
        if (name) setCustomerSignatureName(name);
      },
    });
  };

  const isFormValid =
    hasScrolledToBottom &&
    termsAccepted &&
    stairsOption !== null &&
    customerSignatureName.trim().length > 0 &&
    Boolean(customerSignature) &&
    !submitting;

  const handleConfirmAndStart = async () => {
    if (!jobId) {
      Alert.alert("Error", "Missing job reference ID.");
      return;
    }

    if (!hasScrolledToBottom) {
      Alert.alert(
        "Agreement Incomplete",
        "Please scroll to the bottom of the delivery agreement before accepting."
      );
      return;
    }

    if (!termsAccepted) {
      Alert.alert(
        "Terms Required",
        "Please check the box confirming the customer agrees to the full terms."
      );
      return;
    }

    if (stairsOption === null) {
      Alert.alert(
        "Stairs Selection Required",
        "Please specify whether there are stairs at the property (YES or NO)."
      );
      return;
    }

    if (!customerSignatureName.trim()) {
      Alert.alert(
        "Customer Name Required",
        "Please enter the customer's full name."
      );
      return;
    }

    if (!customerSignature) {
      Alert.alert(
        "Signature Required",
        "Please capture the customer's signature before starting the job."
      );
      return;
    }

    setSubmitting(true);

    try {
      const stairsAtProperty = stairsOption === "yes";

      const startPayload = {
        startAgreement: {
          termsRead: true,
          termsAccepted: true,
          stairsAtProperty,
          stairsOption,
          customerSignature,
          customerSignatureName: customerSignatureName.trim(),
          agreementVersion: "1.0",
        },
      };

      console.log("[StartJob] Submitting start payload for job:", jobId);

      const user = await getStoredUser();
      const response = await API.post(`/jobs/${jobId}/start`, startPayload);
      const updatedRaw =
        response?.job || response?.data?.job || response?.data || response;

      let normalizedUpdatedJob = null;
      if (updatedRaw && typeof updatedRaw === "object") {
        const merged = {
          ...job,
          ...Object.fromEntries(
            Object.entries(updatedRaw).filter(
              ([, value]) => value !== undefined && value !== null
            )
          ),
          status: updatedRaw.status || "in_progress",
          startedAt:
            updatedRaw.startedAt ||
            updatedRaw.jobStartedAt ||
            updatedRaw.actualStartTime ||
            new Date().toISOString(),
          startAgreement: {
            termsRead: true,
            termsAccepted: true,
            stairsAtProperty,
            stairsOption,
            customerSignature,
            customerSignatureName: customerSignatureName.trim(),
            agreementVersion: "1.0",
            acceptedAt: updatedRaw.startedAt || new Date().toISOString(),
            ...(updatedRaw.startAgreement || {}),
          },
        };
        normalizedUpdatedJob = normalizeJob(merged, user);
      }

      setSubmitting(false);
      Alert.alert(
        "Job Started!",
        "Start agreement recorded successfully. The live timer is now active.",
        [
          {
            text: "OK",
            onPress: () => {
              if (typeof route?.params?.onJobStarted === "function") {
                route.params.onJobStarted(normalizedUpdatedJob);
              }
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      setSubmitting(false);

      if (error.response?.status === 401) {
        clearAuthToken();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        return;
      }

      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to start job. Please check network connection.";

      Alert.alert("Start Job Failed", String(errMsg));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            disabled={submitting}
            activeOpacity={0.82}
          >
            <AppIcon library="Ionicons" name="close" size={22} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Start Job Agreement
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              #{jobReference} • {jobTypeLabel.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 60 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Job Summary Banner */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Customer:</Text>
            <Text style={styles.summaryValue}>
              {job.customerName || "Customer"}
            </Text>
          </View>
          {job.pickupAddress || job.pickup ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pickup:</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>
                {job.pickupAddress || job.pickup}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 1. Authorization & Acknowledgment of Terms Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <AppIcon
              library="Ionicons"
              name="document-text-outline"
              size={18}
              color="#0284C7"
            />
            <Text style={styles.cardTitle}>Authorization & Acknowledgment of Terms</Text>
          </View>
          <Text style={styles.cardSub}>
            Scroll to the bottom to confirm the customer has read the full agreement.
          </Text>

          <View style={styles.termsBox}>
            <ScrollView
              nestedScrollEnabled
              onScroll={handleTermsScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.termsScrollContent}
              style={styles.termsScroll}
            >
              <Text style={styles.clauseItem}>
                • I authorize Delivery Plus and its delivery team to access, handle, lift, and transport the items listed in this order from the pickup location to the delivery destination.
              </Text>

              <Text style={styles.clauseItem}>
                • I am the owner of these items, or I have the owner's permission to arrange this delivery.
              </Text>

              <Text style={styles.clauseItem}>
                • I have disclosed any items that are fragile, valuable, hazardous, or require special handling.
              </Text>

              <Text style={styles.clauseItem}>
                • I have read and agree to Delivery Plus's Terms & Conditions, including the sections on liability, delivery timing, and how to file a claim for loss or damage.
              </Text>

              <Text style={styles.clauseItem}>
                • I understand that additional charges may apply as described in the Terms & Conditions (e.g. long carries, stairs, waiting time).
              </Text>
            </ScrollView>
          </View>

          {!hasScrolledToBottom ? (
            <View style={styles.scrollHintRow}>
              <AppIcon library="Ionicons" name="arrow-down-circle" size={15} color="#D97706" />
              <Text style={styles.scrollHintText}>
                Scroll to the bottom of the terms to unlock confirmation.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.checkboxContainerActive}
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  termsAccepted && styles.checkboxChecked,
                ]}
              >
                {termsAccepted ? (
                  <AppIcon library="Ionicons" name="checkmark" size={16} color="#FFF" />
                ) : null}
              </View>
              <Text style={styles.checkboxText}>
                Customer has read and agrees to the full delivery terms.
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2. Stairs Question Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stairs Assessment</Text>
          <Text style={styles.questionText}>
            Are there stairs at the property?
          </Text>

          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[
                styles.radioBtn,
                stairsOption === "yes" && styles.radioBtnActive,
              ]}
              onPress={() => setStairsOption("yes")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.radioOuter,
                  stairsOption === "yes" && styles.radioOuterActive,
                ]}
              >
                {stairsOption === "yes" ? <View style={styles.radioInner} /> : null}
              </View>
              <Text
                style={[
                  styles.radioLabel,
                  stairsOption === "yes" && styles.radioLabelActive,
                ]}
              >
                YES
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.radioBtn,
                stairsOption === "no" && styles.radioBtnActive,
              ]}
              onPress={() => setStairsOption("no")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.radioOuter,
                  stairsOption === "no" && styles.radioOuterActive,
                ]}
              >
                {stairsOption === "no" ? <View style={styles.radioInner} /> : null}
              </View>
              <Text
                style={[
                  styles.radioLabel,
                  stairsOption === "no" && styles.radioLabelActive,
                ]}
              >
                NO
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Customer Signature & Name Card (Matching End Job Flow) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="create-outline" size={20} color="#0284C7" />
            <Text style={styles.cardTitle}>Customer Signature & Name</Text>
          </View>

          {/* Customer Full Name Field */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.inputLabel}>
              Customer Full Name <Text style={styles.mandatoryAsterisk}>*</Text>
            </Text>
            <View style={styles.inputRow}>
              <Ionicons
                name="person-outline"
                size={18}
                color="#0284C7"
                style={{ marginLeft: 12 }}
              />
              <TextInput
                value={customerSignatureName}
                onChangeText={setCustomerSignatureName}
                placeholder="Enter customer's name"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
              />
            </View>
          </View>

          {/* Customer Signature Action Card */}
          <Text style={[styles.inputLabel, { marginTop: 6 }]}>
            Customer Signature <Text style={styles.mandatoryAsterisk}>*</Text>
          </Text>

          {customerSignature ? (
            <View style={styles.signatureCapturedCard}>
              <View style={styles.signatureCapturedHeader}>
                <View style={styles.capturedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.capturedBadgeText}>
                    Signature Captured
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleOpenSignatureScreen}
                  style={styles.reSignBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={14} color="#0284C7" />
                  <Text style={styles.reSignBtnText}>Re-sign</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.signaturePreviewBox}>
                <Image
                  source={{ uri: customerSignature }}
                  style={styles.signaturePreviewImg}
                  resizeMode="contain"
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.signActionBox}
              onPress={handleOpenSignatureScreen}
              activeOpacity={0.85}
            >
              <View style={styles.signIconCircle}>
                <Ionicons name="pencil" size={20} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.signActionTitle}>
                  Capture Customer Signature
                </Text>
                <Text style={styles.signActionSub}>
                  Tap here to open the full-screen signature pad
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* 4. Confirm & Start Job Button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            !isFormValid && styles.submitBtnDisabled,
          ]}
          onPress={handleConfirmAndStart}
          disabled={!isFormValid || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="play-sharp" size={18} color="#FFF" />
              <Text style={styles.submitBtnText}>Confirm & Start Job</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  summaryRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  summaryLabel: {
    width: 75,
    fontSize: 12,
    fontWeight: "700",
    color: "#0369A1",
  },
  summaryValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  cardSub: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 12,
    lineHeight: 16,
  },
  termsBox: {
    height: 180,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
  },
  termsScroll: {
    flex: 1,
  },
  termsScrollContent: {
    paddingBottom: 16,
  },
  clauseHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  clauseBody: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 16,
  },
  clauseItem: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
    marginBottom: 10,
    fontWeight: "500",
  },
  scrollHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scrollHintText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
    flex: 1,
  },
  questionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 12,
  },
  radioGroup: {
    flexDirection: "row",
    gap: 12,
  },
  radioBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  radioBtnActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#0284C7",
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: "#0284C7",
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#0284C7",
  },
  radioLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
  },
  radioLabelActive: {
    color: "#0284C7",
  },
  checkboxContainerActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    backgroundColor: "#F8FAFC",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: "#0284C7",
    borderColor: "#0284C7",
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 18,
  },
  fieldWrapper: {
    marginBottom: 12,
  },
  inputLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  mandatoryAsterisk: {
    color: "#EF4444",
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    height: 48,
    paddingRight: 10,
  },
  textInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    fontWeight: "500",
  },
  signActionBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  signIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  signActionTitle: {
    color: "#0284C7",
    fontSize: 14.5,
    fontWeight: "700",
  },
  signActionSub: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  signatureCapturedCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    padding: 12,
  },
  signatureCapturedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  capturedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  capturedBadgeText: {
    color: "#065F46",
    fontSize: 13,
    fontWeight: "700",
  },
  reSignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#E0F2FE",
  },
  reSignBtnText: {
    color: "#0284C7",
    fontSize: 12,
    fontWeight: "600",
  },
  signaturePreviewBox: {
    height: 90,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
  },
  signaturePreviewImg: {
    width: "100%",
    height: "100%",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0284C7",
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});

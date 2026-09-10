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
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import API, { getAuthToken } from "../services/api";
import {
  extractPaymentProofUrl,
  getSafeUploadLog,
} from "../utils/paymentProof";
import { getDriverVisiblePriceInfo } from "../utils/jobHelpers";

export default function CompleteJobScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const jobId = route?.params?.jobId || route?.params?.id;
  const initialJob = route?.params?.job || {};

  const [currentJob, setCurrentJob] = useState(initialJob);

  useEffect(() => {
    const targetId = jobId || route?.params?.job?._id || route?.params?.job?.id;
    if (targetId) {
      API.get(`/jobs/${targetId}`)
        .then((res) => {
          const fetched = res.job || res.data?.job || res;
          if (fetched && typeof fetched === "object") {
            setCurrentJob(fetched);
          }
        })
        .catch((e) => {
          console.warn("[CompleteJobScreen] Error fetching latest job details:", e?.message);
        });
    }
  }, [jobId]);

  // Form State
  const initialCustomerName =
    route?.params?.customerSignatureName ||
    route?.params?.customerName ||
    currentJob?.customer?.name ||
    currentJob?.customerName ||
    "";
  const [customerName, setCustomerName] = useState(initialCustomerName);

  // Signature Data (received from SignatureScreen)
  const [customerSignature, setCustomerSignature] = useState(
    route?.params?.customerSignature || route?.params?.customerEndSignature || null
  );

  // Sync if route params update
  useEffect(() => {
    if (route?.params?.customerSignature || route?.params?.customerEndSignature) {
      setCustomerSignature(
        route.params.customerSignature || route.params.customerEndSignature
      );
    }
    if (route?.params?.customerSignatureName || route?.params?.customerName) {
      setCustomerName(
        route.params.customerSignatureName || route.params.customerName
      );
    }
    if (route?.params?.job) {
      setCurrentJob(route.params.job);
    }
  }, [route?.params]);

  // 1. Damage Option State
  const [hasDamage, setHasDamage] = useState(false); // false = No Damage, true = Damage Reported
  const [damageReport, setDamageReport] = useState("");
  const [damagePhotos, setDamagePhotos] = useState([]); // array of image assets

  // 2. Checklist & Terms
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(true);
  const [stairsWaiverAccepted, setStairsWaiverAccepted] = useState(
    Boolean(route?.params?.stairsWaiverAccepted)
  );

  // 3. Payment Collection Details
  const priceInfo = getDriverVisiblePriceInfo(currentJob);

  const initialAmount =
    priceInfo.canShowPrice && priceInfo.driverPrice !== null
      ? priceInfo.driverPrice.toString()
      : "";
  const [paymentMethod, setPaymentMethod] = useState("cash"); // cash | online | other
  const [amountReceived, setAmountReceived] = useState(initialAmount);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentProofPhoto, setPaymentProofPhoto] = useState(null);

  const [loading, setLoading] = useState(false);

  // Helper to upload single photo
  const uploadSinglePhoto = async (photo, currentJobId) => {
    if (!photo || !photo.uri) return null;
    try {
      const formData = new FormData();
      const fileName =
        photo.fileName ||
        `photo_${Date.now()}.${(photo.uri || "").split(".").pop() || "jpg"}`;

      formData.append("photos", {
        uri: photo.uri,
        type: photo.type || "image/jpeg",
        name: fileName,
      });

      const token = getAuthToken();
      const response = await fetch(
        `${API.defaults.baseURL}/jobs/${currentJobId}/photos`,
        {
          method: "POST",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "multipart/form-data",
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.warn("Photo upload error:", errText);
        return photo.uri;
      }

      const json = await response.json();
      return (
        extractPaymentProofUrl(json) ||
        json?.url ||
        json?.data?.url ||
        json?.imageUrl ||
        json?.path ||
        photo.uri
      );
    } catch (err) {
      console.warn("Upload exception:", err);
      return photo.uri;
    }
  };

  // Add Damage Photo Dialog
  const handleAddDamagePhoto = () => {
    Alert.alert(
      "Add Damage Photo",
      "Capture a photo of the reported damage or choose from library",
      [
        {
          text: "Camera",
          onPress: () => {
            launchCamera(
              { mediaType: "photo", quality: 0.7, saveToPhotos: true },
              (res) => {
                if (res.assets && res.assets[0]) {
                  setDamagePhotos((prev) => [...prev, res.assets[0]]);
                }
              }
            );
          },
        },
        {
          text: "Photo Library",
          onPress: () => {
            launchImageLibrary(
              { mediaType: "photo", quality: 0.7, selectionLimit: 5 },
              (res) => {
                if (res.assets && res.assets.length > 0) {
                  setDamagePhotos((prev) => [...prev, ...res.assets]);
                }
              }
            );
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const removeDamagePhoto = (index) => {
    setDamagePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Add Payment Proof Photo Dialog
  const handleAddPaymentProof = () => {
    Alert.alert(
      "Payment Receipt Photo",
      "Attach screenshot or receipt photo for this payment",
      [
        {
          text: "Camera",
          onPress: () => {
            launchCamera(
              { mediaType: "photo", quality: 0.7 },
              (res) => {
                if (res.assets && res.assets[0]) {
                  setPaymentProofPhoto(res.assets[0]);
                }
              }
            );
          },
        },
        {
          text: "Photo Library",
          onPress: () => {
            launchImageLibrary(
              { mediaType: "photo", quality: 0.7 },
              (res) => {
                if (res.assets && res.assets[0]) {
                  setPaymentProofPhoto(res.assets[0]);
                }
              }
            );
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // Navigate to dedicated Signature Screen
  const handleOpenSignatureScreen = () => {
    navigation.navigate("Signature", {
      type: "complete",
      jobId,
      job,
      customerSignatureName: customerName.trim(),
      customerName: customerName.trim(),
      onSignatureSaved: (sigBase64, name) => {
        setCustomerSignature(sigBase64);
        if (name) setCustomerName(name);
      },
    });
  };

  // Complete Job Submission
  const handleSubmitComplete = async () => {
    const targetJobId = jobId || route?.params?.id;
    if (!targetJobId) {
      Alert.alert("Error", "Missing Job ID.");
      return;
    }

    if (!deliveryConfirmed) {
      Alert.alert(
        "Confirmation Required",
        "Please check 'Delivery confirmed & goods inspected with customer' before submitting."
      );
      return;
    }

    if (hasDamage && !damageReport.trim()) {
      Alert.alert(
        "Damage Description Required",
        "Please provide a description of the reported damage."
      );
      return;
    }

    if (!customerName.trim()) {
      Alert.alert(
        "Customer Name Required",
        "Please enter the customer's full name."
      );
      return;
    }

    if (!customerSignature) {
      Alert.alert(
        "Customer Signature Required",
        "Please tap 'Capture Customer Signature' to collect the customer's signature.",
        [
          {
            text: "Sign Now",
            onPress: handleOpenSignatureScreen,
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    if (paymentMethod === "online" && !paymentProofPhoto) {
      Alert.alert(
        "Payment Proof Required",
        "Please attach a payment receipt/transfer screenshot for online payments."
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Upload Damage Photos
      let uploadedDamagePhotoUrls = [];
      if (hasDamage && damagePhotos.length > 0) {
        for (const photo of damagePhotos) {
          const url = await uploadSinglePhoto(photo, targetJobId);
          if (url) uploadedDamagePhotoUrls.push(url);
        }
      }

      // 2. Upload Payment Proof Photo
      let paymentProofUrl = undefined;
      if (paymentProofPhoto) {
        paymentProofUrl = await uploadSinglePhoto(paymentProofPhoto, targetJobId);
      }

      // 3. Construct Complete Job Payload
      const parsedAmount = parseFloat(amountReceived);
      const payload = {
        hasDamage: Boolean(hasDamage),
        damageReport: hasDamage ? damageReport.trim() : undefined,
        damagePhotos:
          hasDamage && uploadedDamagePhotoUrls.length > 0
            ? uploadedDamagePhotoUrls
            : undefined,
        termsAccepted: true,
        deliveryConfirmed: Boolean(deliveryConfirmed),
        stairsWaiverAccepted: Boolean(stairsWaiverAccepted),
        customerSignature: customerSignature,
        customerEndSignature: customerSignature,
        signature: customerSignature,
        customerSignatureName: customerName.trim(),
        customerSignatureDate: new Date().toISOString(),
        paymentMethod: paymentMethod.toLowerCase(),
        amountReceived: isNaN(parsedAmount) ? undefined : parsedAmount,
        paymentNotes: paymentNotes.trim() || undefined,
        paymentProofUrl: paymentProofUrl || undefined,
        completionNotes: hasDamage
          ? `Damage reported: ${damageReport.trim()}`
          : "Completed smoothly with No Damage",
      };

      console.log("[JobComplete] Submitting payload:", JSON.stringify(payload, null, 2));

      await API.post(`/jobs/${targetJobId}/complete`, payload);

      Alert.alert("Success", "Job completed and submitted successfully!", [
        {
          text: "OK",
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: "Home" }],
            });
          },
        },
      ]);
    } catch (err) {
      console.error("[JobComplete] Error submitting job:", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to complete job. Please try again.";
      Alert.alert("Submission Failed", errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Complete & End Job
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Job ID: #{jobId || "N/A"}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: "#F4F6FA" }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. CHECKLIST & INSPECTION CONFIRMATION */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="checkbox-outline" size={20} color="#0088FF" />
            <Text style={styles.cardTitle}>Delivery Checklist & Terms</Text>
          </View>

          {/* Mandatory Delivery Confirmed */}
          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.8}
            onPress={() => setDeliveryConfirmed((prev) => !prev)}
          >
            <View
              style={[
                styles.checkboxBox,
                deliveryConfirmed && styles.checkboxBoxChecked,
              ]}
            >
              {deliveryConfirmed && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.checkboxTextWrap}>
              <Text style={styles.checkboxLabel}>
                Delivery confirmed & goods inspected with customer{" "}
                <Text style={styles.mandatoryAsterisk}>*</Text>
              </Text>
              <Text style={styles.checkboxSub}>
                Customer has verified all items received at destination.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Optional Stairs / Special Handling Waiver */}
          <TouchableOpacity
            style={[styles.checkboxRow, { marginTop: 12 }]}
            activeOpacity={0.8}
            onPress={() => setStairsWaiverAccepted((prev) => !prev)}
          >
            <View
              style={[
                styles.checkboxBox,
                stairsWaiverAccepted && styles.checkboxBoxChecked,
              ]}
            >
              {stairsWaiverAccepted && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.checkboxTextWrap}>
              <Text style={styles.checkboxLabel}>
                Stairs / special handling waiver confirmed
              </Text>
              <Text style={styles.checkboxSub}>
                Optional: Applicable if stairs or tight access was encountered.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 2. PAYMENT COLLECTION DETAILS */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="cash-outline" size={20} color="#0088FF" />
            <Text style={styles.cardTitle}>Payment Collection Details</Text>
          </View>

          {/* Amount to Collect Summary Card */}
          {priceInfo.canShowPrice ? (
            <View style={styles.amountToCollectBox}>
              <Text style={styles.amountToCollectLabel}>AMOUNT TO COLLECT</Text>
              <Text style={styles.amountToCollectValue}>
                {priceInfo.formattedPrice}
              </Text>
              <Text style={styles.amountToCollectSubtext}>
                Price provided by Delivery Plus
              </Text>
            </View>
          ) : null}

          {/* Payment Mode Pills */}
          <Text style={styles.inputLabel}>Payment Mode</Text>
          <View style={styles.paymentMethodsRow}>
            {[
              { key: "cash", label: "Cash", icon: "cash-outline" },
              { key: "online", label: "Online / EFT", icon: "card-outline" },
              { key: "other", label: "Other", icon: "ellipsis-horizontal" },
            ].map((m) => {
              const selected = paymentMethod === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setPaymentMethod(m.key)}
                  style={[
                    styles.paymentPill,
                    selected && styles.paymentPillSelected,
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={m.icon}
                    size={15}
                    color={selected ? "#FFFFFF" : "#64748B"}
                    style={styles.paymentPillIcon}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.paymentPillText,
                      selected && styles.paymentPillTextSelected,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Amount Received Input */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.inputLabel}>Amount Received ($)</Text>
            <View style={styles.inputRow}>
              <Ionicons
                name="pricetag-outline"
                size={18}
                color="#0088FF"
                style={{ marginLeft: 10 }}
              />
              <TextInput
                value={amountReceived}
                onChangeText={setAmountReceived}
                placeholder="Enter amount collected"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                style={styles.textInput}
              />
            </View>
          </View>

          {/* Payment Notes */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.inputLabel}>Payment Notes (Optional)</Text>
            <View style={[styles.inputRow, { height: 46 }]}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color="#0088FF"
                style={{ marginLeft: 10 }}
              />
              <TextInput
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                placeholder="e.g. Paid in full cash, invoice #123"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
              />
            </View>
          </View>

          {/* Payment Receipt / Proof Photo */}
          <View style={{ marginTop: 10 }}>
            <Text style={styles.inputLabel}>
              Payment Receipt / Transfer Proof{" "}
              {paymentMethod === "online" && (
                <Text style={styles.mandatoryAsterisk}>*</Text>
              )}
            </Text>

            {paymentProofPhoto ? (
              <View style={styles.paymentPreviewContainer}>
                <Image
                  source={{ uri: paymentProofPhoto.uri }}
                  style={styles.paymentPreviewImg}
                />
                <TouchableOpacity
                  style={styles.removePhotoBadge}
                  onPress={() => setPaymentProofPhoto(null)}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={handleAddPaymentProof}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#0088FF" />
                <Text style={styles.uploadBtnText}>
                  Upload Payment Proof Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 3. ITEM INSPECTION & DAMAGE STATUS (UNCHANGED) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons
              name={hasDamage ? "warning" : "shield-checkmark"}
              size={20}
              color={hasDamage ? "#EF4444" : "#10B981"}
            />
            <Text style={styles.cardTitle}>Item Inspection & Damage Status</Text>
          </View>

          <Text style={styles.sectionSubtitle}>
            Select whether any damage occurred to goods or property:
          </Text>

          {/* Toggle Buttons */}
          <View style={styles.damageToggleRow}>
            {/* 🟢 NO DAMAGE BUTTON */}
            <TouchableOpacity
              style={[
                styles.damageOptionCard,
                !hasDamage && styles.damageOptionCardNoDamageActive,
              ]}
              onPress={() => setHasDamage(false)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.damageRadioCircle,
                  !hasDamage && styles.damageRadioCircleGreen,
                ]}
              >
                {!hasDamage && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.damageOptionTitle,
                    !hasDamage && { color: "#065F46", fontWeight: "700" },
                  ]}
                >
                  No Damage
                </Text>
                <Text style={styles.damageOptionDesc}>
                  All items in good & safe condition
                </Text>
              </View>
            </TouchableOpacity>

            {/* DAMAGE REPORTED BUTTON */}
            <TouchableOpacity
              style={[
                styles.damageOptionCard,
                hasDamage && styles.damageOptionCardDamageActive,
              ]}
              onPress={() => setHasDamage(true)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.damageRadioCircle,
                  hasDamage && styles.damageRadioCircleRed,
                ]}
              >
                {hasDamage && (
                  <Ionicons name="alert" size={12} color="#FFFFFF" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.damageOptionTitle,
                    hasDamage && { color: "#991B1B", fontWeight: "700" },
                  ]}
                >
                  Damage Reported
                </Text>
                <Text style={styles.damageOptionDesc}>
                  Scratch, dent, or broken item noted
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* EXPANDABLE DAMAGE DETAILS (WHEN DAMAGE SELECTED) */}
          {hasDamage && (
            <View style={styles.damageExpandedBox}>
              <Text style={styles.inputLabel}>
                Damage Description / Notes{" "}
                <Text style={styles.mandatoryAsterisk}>*</Text>
              </Text>
              <View style={styles.damageTextAreaWrapper}>
                <TextInput
                  value={damageReport}
                  onChangeText={setDamageReport}
                  placeholder="Describe the damage in detail (e.g. Scratch on dining table leg during unload)..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  style={styles.damageTextInput}
                />
              </View>

              {/* Upload Damage Photos */}
              <View style={{ marginTop: 14 }}>
                <Text style={styles.inputLabel}>Upload Damage Photos</Text>

                {damagePhotos.length > 0 && (
                  <View style={styles.damagePhotosGrid}>
                    {damagePhotos.map((p, idx) => (
                      <View key={idx} style={styles.damagePhotoThumbWrap}>
                        <Image
                          source={{ uri: p.uri }}
                          style={styles.damagePhotoThumb}
                        />
                        <TouchableOpacity
                          style={styles.removePhotoBadge}
                          onPress={() => removeDamagePhoto(idx)}
                        >
                          <Ionicons name="close" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={handleAddDamagePhoto}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={20} color="#0088FF" />
                  <Text style={styles.uploadBtnText}>
                    + Add Damage Photo ({damagePhotos.length} attached)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 4. CUSTOMER DETAILS & SIGNATURE SECTION (NAVIGATES TO SEPARATE SCREEN) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="create-outline" size={20} color="#0088FF" />
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
                color="#0088FF"
                style={{ marginLeft: 10 }}
              />
              <TextInput
                value={customerName}
                onChangeText={setCustomerName}
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
                  <Ionicons name="refresh" size={14} color="#0088FF" />
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
                <Ionicons name="pencil" size={22} color="#0088FF" />
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

        {/* 5. COMPLETE & SUBMIT JOB BUTTON */}
        <TouchableOpacity
          style={[styles.submitBtnWrapper, loading && styles.submitBtnDisabled]}
          onPress={handleSubmitComplete}
          disabled={loading}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={["#0098FF", "#00C6FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitBtnGradient}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitBtnText}>
                  Submitting & Completing...
                </Text>
              </View>
            ) : (
              <View style={styles.loadingRow}>
                <Text style={styles.submitBtnText}>Complete & Submit Job</Text>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginLeft: 6 }}
                />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 23,
  },
  headerSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
    marginTop: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
  },

  // Cards
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 15.5,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "#64748B",
    fontSize: 13,
    marginBottom: 12,
  },

  // Checkboxes
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: "#0088FF",
    borderColor: "#0088FF",
  },
  checkboxTextWrap: {
    flex: 1,
  },
  checkboxLabel: {
    color: "#1E293B",
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 18,
  },
  checkboxSub: {
    color: "#64748B",
    fontSize: 11.5,
    marginTop: 2,
  },
  mandatoryAsterisk: {
    color: "#EF4444",
    fontWeight: "700",
  },

  // Payment Methods
  paymentMethodsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    alignItems: "stretch",
  },
  paymentPill: {
    flex: 1,
    minHeight: 44,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  paymentPillSelected: {
    backgroundColor: "#0088FF",
    borderColor: "#0088FF",
  },
  paymentPillIcon: {
    marginRight: 4,
    alignSelf: "center",
  },
  paymentPillText: {
    color: "#475569",
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    includeFontPadding: false,
    lineHeight: 14,
  },
  paymentPillTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Form Fields
  fieldWrapper: {
    marginBottom: 12,
  },
  inputLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
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

  // Upload Buttons
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#93C5FD",
    borderStyle: "dashed",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingVertical: 12,
  },
  uploadBtnText: {
    color: "#0072FF",
    fontSize: 13.5,
    fontWeight: "600",
  },
  paymentPreviewContainer: {
    position: "relative",
    width: 110,
    height: 110,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  paymentPreviewImg: {
    width: "100%",
    height: "100%",
  },
  removePhotoBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  // Damage Toggle Section
  damageToggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  damageOptionCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    gap: 8,
  },
  damageOptionCardNoDamageActive: {
    borderColor: "#10B981",
    backgroundColor: "#ECFDF5",
  },
  damageOptionCardDamageActive: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  damageRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },
  damageRadioCircleGreen: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  damageRadioCircleRed: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  damageOptionTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#334155",
  },
  damageOptionDesc: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 2,
  },
  damageExpandedBox: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#FEE2E2",
  },
  damageTextAreaWrapper: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    padding: 10,
  },
  damageTextInput: {
    color: "#0F172A",
    fontSize: 13.5,
    minHeight: 80,
    textAlignVertical: "top",
  },
  damagePhotosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  damagePhotoThumbWrap: {
    position: "relative",
    width: 76,
    height: 76,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  damagePhotoThumb: {
    width: "100%",
    height: "100%",
  },

  // Customer Signature Action Card
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

  // Submit Button
  submitBtnWrapper: {
    height: 54,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 20,
    shadowColor: "#0088FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  // Amount to Collect Summary
  amountToCollectBox: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  amountToCollectLabel: {
    color: "#1E40AF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  amountToCollectValue: {
    color: "#1E3A8A",
    fontSize: 26,
    fontWeight: "900",
  },
  amountToCollectSubtext: {
    color: "#3B82F6",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});
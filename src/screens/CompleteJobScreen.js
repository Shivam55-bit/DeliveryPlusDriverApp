import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Image,
  TextInput,
  Alert,
  StatusBar,
} from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import LinearGradient from "react-native-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import API, { getAuthToken, clearAuthToken } from "../services/api";
import AppIcon from "../components/common/AppIcon";
import {
  extractPaymentProofUrl,
  getSafeUploadLog,
  isPaymentProofUrl,
} from "../utils/paymentProof";

export default function CompleteJobScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const jobId = route?.params?.jobId;
  const job = route?.params?.job || {};
  const termsAccepted = route?.params?.termsAccepted || false;
  const customerEndSignature = route?.params?.customerEndSignature || null;
  const termsReadAt = route?.params?.termsReadAt || null;
  const deliveryConfirmed = route?.params?.deliveryConfirmed || false;
  const stairsAtProperty = route?.params?.stairsAtProperty || null;
  const stairsWaiverAccepted = route?.params?.stairsWaiverAccepted || false;
  const customerSignatureName = route?.params?.customerSignatureName || null;
  const customerSignatureDate = route?.params?.customerSignatureDate || null;
  const driverName = route?.params?.driverName || null;
  const driverCompletionSignature = route?.params?.driverCompletionSignature || null;

  const [paymentMethod, setPaymentMethod] = useState("cash"); // cash | online | other
  const [transactionRef, setTransactionRef] = useState("");
  const [otherDetails, setOtherDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [imageObj, setImageObj] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isOtherPaymentMissingDetails = paymentMethod === "other" && !otherDetails.trim();
  const isOnlinePaymentProofRequired = paymentMethod === "online" && !imageObj;
  const isSubmitDisabled = isOtherPaymentMissingDetails || isOnlinePaymentProofRequired;

  const isMovingJob = job.isMovingJob || job.jobTypeKey === "moving";
  const pricing = job.pricing || {};

  const openCamera = () => {
    launchCamera({ mediaType: "photo", quality: 0.7 }, (res) => {
      if (res.assets && res.assets[0]) {
        setImageUri(res.assets[0].uri);
        setImageObj(res.assets[0]);
      }
    });
  };

  const openGallery = () => {
    launchImageLibrary({ mediaType: "photo", quality: 0.7 }, (res) => {
      if (res.assets && res.assets[0]) {
        setImageUri(res.assets[0].uri);
        setImageObj(res.assets[0]);
      }
    });
  };

  const removePhoto = () => {
    setImageUri(null);
    setImageObj(null);
  };

  const handleBack = () => {
    Keyboard.dismiss();
    navigation.goBack();
  };

  const handleSubmitComplete = async () => {
    if (!jobId) {
      Alert.alert("Error", "Missing Job ID");
      return;
    }

    if (!termsAccepted) {
      Alert.alert(
        "Terms required",
        "Please accept the terms before completing the job."
      );
      return;
    }

    if (
      !customerEndSignature ||
      typeof customerEndSignature !== "string" ||
      customerEndSignature.length < 100
    ) {
      Alert.alert(
        "Signature required",
        "Customer end signature is missing. Please sign again."
      );
      return;
    }

    if (paymentMethod === "other" && !otherDetails.trim()) {
      Alert.alert("Validation Error", "Please provide details for the 'Other' payment method.");
      return;
    }

    if (paymentMethod === "online" && !imageObj) {
      Alert.alert(
        "Validation Error",
        "Please attach payment proof photo when using Online Payment."
      );
      return;
    }

    setSubmitting(true);

    try {
      let photoUpload = null;
      if (imageObj) {
        const formData = new FormData();
        const fileName = imageObj.fileName || `photo_${Date.now()}.${(imageObj.uri || "").split(".").pop() || "jpg"}`;
        formData.append("photos", {
          uri: imageObj.uri,
          type: imageObj.type || "image/jpeg",
          name: fileName,
        });

        const token = getAuthToken();
        const response = await fetch(`${API.defaults.baseURL}/jobs/${jobId}/photos`, {
          method: "POST",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "multipart/form-data",
          },
          body: formData,
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          throw new Error(errorBody || `Photo upload failed (${response.status})`);
        }
        photoUpload = await response.json();
      }

      const paymentProofUrl = extractPaymentProofUrl(photoUpload);

      console.log("JOB_PHOTO_UPLOAD_RESPONSE", getSafeUploadLog(photoUpload, paymentProofUrl));

      if (imageObj && !isPaymentProofUrl(paymentProofUrl)) {
        throw new Error("Photo uploaded, but the server did not return a valid proof URL.");
      }

      const payload = {
        termsAccepted: Boolean(termsAccepted),
        termsReadAt: termsReadAt || new Date().toISOString(),
        termsAcceptedAt: termsReadAt || new Date().toISOString(),
        termsVersion: job.termsVersion ?? undefined,
        deliveryConfirmed: Boolean(deliveryConfirmed),
        stairsAtProperty,
        stairsWaiverAccepted: Boolean(stairsWaiverAccepted),
        customerEndSignature,
        signature: customerEndSignature,
        customerSignature: customerEndSignature,
        customerSignatureName: customerSignatureName?.trim(),
        customerSignatureDate: customerSignatureDate?.trim(),
        driverName: driverName?.trim(),
        driverCompletionSignature,
        paymentMethod: paymentMethod?.toLowerCase(),
        paymentTransactionReference: transactionRef.trim() || undefined,
        transactionReference: transactionRef.trim() || undefined,
        otherPaymentDetails: otherDetails.trim() || undefined,
        paymentNotes: notes.trim() || undefined,
        completionNotes: notes.trim() || "Job completed by driver",
        damageReport: notes.trim() || undefined,
        amountReceived: pricing.finalCost || pricing.minimumEstimatedCost || undefined,
        paymentProofUrl,
        paymentProof: paymentProofUrl,
      };

      console.log("JOB_COMPLETION_PAYLOAD_DEBUG", {
        ...payload,
        customerEndSignature: Boolean(payload.customerEndSignature),
        signature: Boolean(payload.signature),
        customerSignature: Boolean(payload.customerSignature),
        driverCompletionSignature: Boolean(payload.driverCompletionSignature),
      });

      await API.post(`/jobs/${jobId}/complete`, payload);

      Alert.alert("Job Completed!", "The job has been finished successfully.", [
        { text: "OK", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }) },
      ]);
    } catch (error) {
      if (error.response?.status === 401) {
        clearAuthToken();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      } else {
        Alert.alert("Error", error.message || "Unable to complete job.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#0B2545" />

        {/* ── Gradient Header ── */}
        <View style={styles.headerWrap}>
          <LinearGradient
            colors={["#0B2545", "#134074", "#0077B6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.headerGradient,
              { paddingTop: Math.max(insets.top, 16) + 12 },
            ]}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppIcon library="Ionicons" name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Final Payment & Submit</Text>
              <View style={styles.headerRightSpacer} />
            </View>
          </LinearGradient>
        </View>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 40 + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          >
            {/* ── Pricing Summary (Moving Jobs Only) ── */}
            {isMovingJob && (pricing.finalCost || pricing.minimumEstimatedCost) ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Final Pricing Summary</Text>
                <Text style={styles.cardSub}>Moving service cost breakup</Text>

                <View style={styles.priceContainer}>
                  {pricing.minimumEstimatedCost ? (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Estimated Cost</Text>
                      <Text style={styles.priceValue}>${pricing.minimumEstimatedCost}</Text>
                    </View>
                  ) : null}

                  {pricing.extraTimeCharge ? (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Extra Time Charge</Text>
                      <Text style={styles.priceValue}>+${pricing.extraTimeCharge}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.priceRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total Final Cost</Text>
                    <Text style={styles.totalValue}>
                      ${pricing.finalCost || pricing.minimumEstimatedCost || "0.00"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ── Section 1: Payment Method ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Select Payment Method</Text>
              <Text style={styles.cardSub}>Choose how the customer paid for this job</Text>

              <View style={styles.methodGroup}>
                {/* Cash Option */}
                <TouchableOpacity
                  style={[
                    styles.methodItem,
                    paymentMethod === "cash" && styles.methodItemActive,
                  ]}
                  onPress={() => setPaymentMethod("cash")}
                  activeOpacity={0.8}
                >
                  <View style={styles.methodRadio}>
                    {paymentMethod === "cash" ? <View style={styles.radioDot} /> : null}
                  </View>
                  <AppIcon library="Ionicons" name="cash-outline" size={20} color="#16A34A" />
                  <Text style={styles.methodText}>Cash Payment</Text>
                </TouchableOpacity>

                {/* Online Payment Option */}
                <TouchableOpacity
                  style={[
                    styles.methodItem,
                    paymentMethod === "online" && styles.methodItemActive,
                  ]}
                  onPress={() => setPaymentMethod("online")}
                  activeOpacity={0.8}
                >
                  <View style={styles.methodRadio}>
                    {paymentMethod === "online" ? <View style={styles.radioDot} /> : null}
                  </View>
                  <AppIcon library="Ionicons" name="card-outline" size={20} color="#0284C7" />
                  <Text style={styles.methodText}>Online Payment / Transfer</Text>
                </TouchableOpacity>

                {/* Other Option */}
                <TouchableOpacity
                  style={[
                    styles.methodItem,
                    paymentMethod === "other" && styles.methodItemActive,
                  ]}
                  onPress={() => setPaymentMethod("other")}
                  activeOpacity={0.8}
                >
                  <View style={styles.methodRadio}>
                    {paymentMethod === "other" ? <View style={styles.radioDot} /> : null}
                  </View>
                  <AppIcon
                    library="MaterialCommunityIcons"
                    name="dots-horizontal-circle-outline"
                    size={20}
                    color="#D97706"
                  />
                  <Text style={styles.methodText}>Other Payment</Text>
                </TouchableOpacity>
              </View>

              {/* Conditional inputs */}
              {paymentMethod === "online" ? (
                <View style={styles.extraSection}>
                  <Text style={styles.fieldLabel}>Transaction Reference (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter transaction ref / UPI ID"
                    value={transactionRef}
                    onChangeText={setTransactionRef}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              ) : null}

              {paymentMethod === "other" ? (
                <View style={styles.extraSection}>
                  <Text style={styles.fieldLabel}>Payment Details *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Specify payment details or cheque info..."
                    value={otherDetails}
                    onChangeText={setOtherDetails}
                    placeholderTextColor="#94A3B8"
                  />
                  {isOtherPaymentMissingDetails ? (
                    <Text style={styles.validationText}>
                      Please enter the details for Other payment before completing the job.
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* ── Section 2: Photo Proof / Attachment ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment / Delivery Proof Photo</Text>
              <Text style={styles.cardSub}>
                {paymentMethod === "online"
                  ? "Upload proof of online payment (required)."
                  : "Attach photo of receipt or delivered goods (optional)."}
              </Text>

              {imageUri ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={removePhoto}>
                    <AppIcon library="Ionicons" name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={openCamera}>
                    <AppIcon library="Ionicons" name="camera-outline" size={20} color="#0B2545" />
                    <Text style={styles.photoBtnText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.photoBtn} onPress={openGallery}>
                    <AppIcon library="Ionicons" name="image-outline" size={20} color="#0B2545" />
                    <Text style={styles.photoBtnText}>Choose Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ── Section 3: Completion Notes ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Driver Completion Notes</Text>
              <Text style={styles.cardSub}>Add any relevant notes or damage comments</Text>

              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Enter job notes, comments, or damage report..."
                placeholderTextColor="#94A3B8"
                multiline
                value={notes}
                onChangeText={setNotes}
                blurOnSubmit={false}
                returnKeyType="done"
                textAlignVertical="top"
              />
            </View>

            {/* ── Submit Button ── */}
            <TouchableOpacity
              style={[styles.submitBtn, isSubmitDisabled && styles.submitBtnDisabled]}
              onPress={handleSubmitComplete}
              disabled={isSubmitDisabled || submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? "Completing Job..." : "Complete & Finish Job"}
              </Text>
              <AppIcon library="Ionicons" name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F6FA",
  },
  headerWrap: {
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  headerGradient: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  headerRightSpacer: {
    width: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
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
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 14,
  },
  priceContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  priceValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#16A34A",
  },
  methodGroup: {
    gap: 10,
  },
  methodItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  methodItemActive: {
    borderColor: "#0B2545",
    backgroundColor: "#F0F4F8",
  },
  methodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0B2545",
  },
  methodText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  extraSection: {
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  multilineInput: {
    height: 90,
    textAlignVertical: "top",
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  photoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B2545",
  },
  imagePreviewWrap: {
    position: "relative",
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16A34A",
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  validationText: {
    marginTop: 8,
    color: "#B91C1C",
    fontSize: 12,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
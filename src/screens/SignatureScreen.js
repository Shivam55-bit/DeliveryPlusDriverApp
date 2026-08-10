import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from "react-native";
import Signature from "react-native-signature-canvas";
import API, { getAuthToken } from "../services/api";

export default function SignatureScreen({ navigation, route }) {
  const ref = useRef(null);
  const [loading, setLoading] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [isSigning, setIsSigning] = useState(false);

  const uploadJobPhoto = async (photo, jobId) => {
    if (!photo || !jobId) return;

    const formData = new FormData();
    const fileName = photo.fileName || `photo.${(photo.uri || "").split(".").pop() || "jpg"}`;

    formData.append("photos", {
      uri: photo.uri,
      type: photo.type || "image/jpeg",
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
      const errorBody = await response.text().catch(() => null);
      throw new Error(errorBody || "Photo upload failed");
    }

    return response.json();
  };

  const completeJob = async (signature) => {
    const jobId = route?.params?.jobId;
    if (!jobId) throw new Error("Missing job ID.");

    if (route?.params?.photo) {
      await uploadJobPhoto(route.params.photo, jobId);
    }

    const payload = {
      signature,
      completionNotes: route?.params?.notes || "Job completed by driver",
      damageReport: route?.params?.notes,
    };

    await API.post(`/jobs/${jobId}/complete`, payload);
  };

  const onOK = async (signature) => {
    if (!signature) {
      Alert.alert("Signature required", "Please sign before confirming.");
      return;
    }

    setSignatureData(signature);
    setLoading(true);

    try {
      const jobId = route?.params?.jobId;
      if (!jobId) throw new Error("Missing job ID.");

      if (route?.params?.type === "start") {
        await API.post(`/jobs/${jobId}/start`, { signature });
        Alert.alert("Success", "Job started successfully");
        navigation.goBack();
      } else if (route?.params?.type === "complete") {
        await completeJob(signature);
        Alert.alert("Success", "Job completed successfully");
        navigation.navigate("Home");
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error("Signature error:", error);
      Alert.alert("Error", error?.message || "Failed to process signature");
    } finally {
      setLoading(false);
    }
  };

  const onEmpty = () => {
    Alert.alert("Signature empty", "Please draw your signature before confirming.");
  };

  const onError = (error) => {
    console.error("Signature pad error:", error);
    Alert.alert("Signature error", String(error));
  };

  const handleSkip = () => {
    if (route?.params?.type === "start") {
      onOK("skipped");
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>
          {route?.params?.type === "start"
            ? "Start Job Signature"
            : "Complete Job Signature"}
        </Text>

        {/* Signature Pad */}
        <View style={styles.signatureBox}>
          <Signature
            ref={ref}
            style={styles.signatureCanvas}
            onOK={onOK}
            onError={onError}
            onEmpty={onEmpty}
            onBegin={() => setIsSigning(true)}
            onEnd={() => setIsSigning(false)}
            descriptionText="Sign above"
            clearText="Clear"
            confirmText="Confirm"
            autoClear={false}
            penColor="#000"
            backgroundColor="#fff"
            webStyle={
              "html, body { margin: 0; padding: 0; overflow: hidden !important; touch-action: none !important; } " +
              "canvas { touch-action: none !important; } " +
              ".m-signature-pad--footer { display: none !important; } " +
              ".m-signature-pad { width: 100% !important; height: 100% !important; }"
            }
          />
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              setSignatureData(null);
              ref.current?.clearSignature();
            }}
            disabled={loading}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => ref.current?.readSignature()}
            disabled={loading}
          >
            <Text style={styles.confirmText}>{loading ? "Processing..." : "Submit"}</Text>
          </TouchableOpacity>
        </View>

        {route?.params?.type === "start" && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipText}>Skip Signature</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F6FA",
  },

  container: {
    flex: 1,
    padding: 20,
  },

  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 15,
  },

  signatureBox: {
    flex: 1,
    minHeight: 420,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#fff",
  },

  signatureCanvas: {
    flex: 1,
    width: "100%",
    height: "100%",
  },

  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  clearBtn: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 14,
    borderRadius: 8,
    width: "48%",
    alignItems: "center",
  },

  confirmBtn: {
    backgroundColor: "#2F80ED",
    paddingVertical: 14,
    borderRadius: 8,
    width: "48%",
    alignItems: "center",
  },

  clearText: {
    color: "#111827",
    fontWeight: "600",
  },

  confirmText: {
    color: "#fff",
    fontWeight: "600",
  },

  skipBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },

  skipText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 14,
  },
});
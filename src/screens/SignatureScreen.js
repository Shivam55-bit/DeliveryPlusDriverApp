import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from "react-native";
import { WebView } from "react-native-webview";
import API, { getAuthToken } from "../services/api";
import AppIcon from "../components/common/AppIcon";
import {
  extractPaymentProofUrl,
  getSafeUploadLog,
} from "../utils/paymentProof";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SignatureScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [hasStroke, setHasStroke] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const isStartFlow = route?.params?.type === "start";
  const titleText = isStartFlow ? "Driver Signature" : "Customer Signature";
  const subtitleText = isStartFlow
    ? "Please sign below to confirm the start of the job."
    : "Please sign below to confirm completion of the job.";

  const signatureHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #fff; touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  #signature-wrapper { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; overscroll-behavior: contain; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  #signature-canvas { display: block; width: 100%; height: 100%; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
</style>
</head>
<body>
  <div id="signature-wrapper">
    <canvas id="signature-canvas"></canvas>
  </div>
  <script>
    (function() {
      const wrapper = document.getElementById('signature-wrapper');
      const canvas = document.getElementById('signature-canvas');
      const ctx = canvas.getContext('2d');
      let drawing = false;
      let lastPoint = null;
      let hasStroke = false;
      const originalStyle = {
        bodyOverflow: document.body.style.overflow || '',
        htmlOverflow: document.documentElement.style.overflow || '',
      };
      const ratio = window.devicePixelRatio || 1;

      function resizeCanvas() {
        const rect = wrapper.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dataUrl = canvas.toDataURL();
        canvas.width = Math.floor(rect.width * ratio);
        canvas.height = Math.floor(rect.height * ratio);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0F172A';
        if (dataUrl && dataUrl.startsWith('data:image/png')) {
          const image = new Image();
          image.onload = function() {
            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.drawImage(image, 0, 0, rect.width, rect.height);
          };
          image.src = dataUrl;
        }
      }

      function getPoint(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        return { x, y };
      }

      function lockScroll() {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      }

      function unlockScroll() {
        document.body.style.overflow = originalStyle.bodyOverflow;
        document.documentElement.style.overflow = originalStyle.htmlOverflow;
      }

      function startDrawing(point) {
        drawing = true;
        lastPoint = point;
        if (!hasStroke) {
          hasStroke = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stroke' }));
        }
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        lockScroll();
      }

      function continueDrawing(point) {
        if (!drawing) return;
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPoint = point;
      }

      function stopDrawing(event) {
        if (!drawing) return;
        drawing = false;
        lastPoint = null;
        unlockScroll();
      }

      function handlePointerDown(event) {
        if (event.pointerType !== 'mouse' && event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        startDrawing(getPoint(event));
      }

      function handlePointerMove(event) {
        if (!drawing) return;
        event.preventDefault();
        continueDrawing(getPoint(event));
      }

      function handlePointerUp(event) {
        if (!drawing) return;
        event.preventDefault();
        stopDrawing(event);
      }

      function handleTouchStart(event) {
        if (!event.touches || event.touches.length === 0) return;
        event.preventDefault();
        const touch = event.touches[0];
        startDrawing(getPoint(touch));
      }

      function handleTouchMove(event) {
        if (!drawing || !event.touches || event.touches.length === 0) return;
        event.preventDefault();
        const touch = event.touches[0];
        continueDrawing(getPoint(touch));
      }

      function handleTouchEnd(event) {
        if (!drawing) return;
        event.preventDefault();
        stopDrawing(event);
      }

      function clearCanvas() {
        const rect = wrapper.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        hasStroke = false;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cleared' }));
      }

      function saveSignature() {
        const dataUrl = canvas.toDataURL('image/png');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: dataUrl }));
      }

      function handleMessage(event) {
        let message = null;
        try {
          message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch (err) {
          return;
        }
        if (!message || !message.type) return;
        if (message.type === 'clear') {
          clearCanvas();
        } else if (message.type === 'save') {
          saveSignature();
        } else if (message.type === 'resize') {
          resizeCanvas();
        }
      }

      window.addEventListener('resize', function() {
        setTimeout(resizeCanvas, 50);
      });
      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage);
      canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
      canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
      canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
      canvas.addEventListener('pointercancel', handlePointerUp, { passive: false });
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

      resizeCanvas();
    })();
  </script>
</body>
</html>`;

  const handleCanvasMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'signature') {
        setSignatureData(message.data);
        if (pendingConfirm) {
          setPendingConfirm(false);
          onOK(message.data);
        }
      } else if (message.type === 'stroke') {
        setHasStroke(true);
      } else if (message.type === 'cleared') {
        setSignatureData(null);
        setHasStroke(false);
      }
    } catch (err) {
      // ignore non-JSON messages
    }
  };

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

    const params = route?.params || {};
    const notes = params.notes?.trim();
    const photoUpload = params.photo ? await uploadJobPhoto(params.photo, jobId) : null;
    const hasFullCompletionData = Boolean(
      params.termsAccepted || params.customerEndSignature
    );
    const paymentProofUrl = extractPaymentProofUrl(photoUpload);
    console.log("JOB_PHOTO_UPLOAD_RESPONSE", getSafeUploadLog(photoUpload, paymentProofUrl));
    const payload = hasFullCompletionData
      ? {
          termsAccepted: Boolean(params.termsAccepted),
          termsReadAt: params.termsReadAt || new Date().toISOString(),
          termsAcceptedAt: params.termsReadAt || new Date().toISOString(),
          termsVersion: params.job?.termsVersion ?? undefined,
          deliveryConfirmed: Boolean(params.deliveryConfirmed),
          stairsAtProperty: params.stairsAtProperty,
          stairsWaiverAccepted: Boolean(params.stairsWaiverAccepted),
          customerEndSignature: params.customerEndSignature,
          signature: params.customerEndSignature,
          customerSignature: params.customerEndSignature,
          customerSignatureName: params.customerSignatureName?.trim(),
          customerSignatureDate: params.customerSignatureDate?.trim(),
          driverName: params.driverName?.trim(),
          driverCompletionSignature: signature,
          paymentMethod: params.paymentMethod?.toLowerCase(),
          paymentTransactionReference: params.transactionRef?.trim() || undefined,
          transactionReference: params.transactionRef?.trim() || undefined,
          otherPaymentDetails: params.otherDetails?.trim() || undefined,
          paymentNotes: notes || undefined,
          completionNotes: notes || "Job completed by driver",
          damageReport: notes || undefined,
          amountReceived:
            params.pricing?.finalCost || params.pricing?.minimumEstimatedCost || undefined,
          paymentProofUrl,
          paymentProof: paymentProofUrl || undefined,
        }
      : {
          signature,
          completionNotes: notes || "Job completed by driver",
          damageReport: notes || undefined,
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
        const hasFullCompletionData = Boolean(
          route?.params?.termsAccepted || route?.params?.customerEndSignature
        );

        if (hasFullCompletionData) {
          navigation.replace("CompleteJob", {
            ...route.params,
            customerEndSignature: signature,
            driverCompletionSignature: signature,
          });
        } else {
          await completeJob(signature);
          Alert.alert("Success", "Job completed successfully");
          navigation.navigate("Home");
        }
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

  const handleClear = () => {
    setSignatureData(null);
    setHasStroke(false);
    webviewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
  };

  const handleContinue = () => {
    if (!hasStroke) {
      Alert.alert("Signature required", "Please provide your signature to continue.");
      return;
    }

    setPendingConfirm(true);
    webviewRef.current?.postMessage(JSON.stringify({ type: 'save' }));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, { paddingBottom: 20 + insets.bottom }]}> 
        <StatusBar barStyle="light-content" backgroundColor="#0B2545" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <AppIcon library="Ionicons" name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>{titleText}</Text>
            <Text style={styles.subtitle}>{subtitleText}</Text>
          </View>
        </View>

        <Text style={styles.label}>Sign below</Text>
        <Text style={styles.helper}>Use your finger, stylus, or mouse to sign inside the box.</Text>

        <View style={styles.signatureBox}>
          <View style={styles.signatureGuide} pointerEvents="none" />
          <WebView
            ref={webviewRef}
            originWhitelist={["*"]}
            source={{ html: signatureHtml }}
            style={styles.signatureCanvas}
            onMessage={handleCanvasMessage}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowUniversalAccessFromFileURLs
            automaticallyAdjustContentInsets={false}
            mixedContentMode="never"
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            disabled={loading}
          >
            <AppIcon library="Ionicons" name="refresh-outline" size={18} color="#475569" />
            <Text style={styles.clearText}>Clear Signature</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmBtn, (!hasStroke || loading) && styles.confirmBtnDisabled]}
            onPress={handleContinue}
            disabled={loading || !hasStroke}
          >
            <Text style={styles.confirmText}>{loading ? "Processing..." : "Confirm Signature"}</Text>
            <AppIcon library="Ionicons" name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
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
    backgroundColor: "#F4F6FA",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B2545",
    marginHorizontal: -20,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 12,
  },

  backButton: {
    padding: 4,
  },

  title: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
  },

  subtitle: {
    color: "#D9EAF7",
    fontSize: 13,
    marginTop: 4,
  },

  label: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 28,
  },

  helper: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 5,
    marginBottom: 12,
  },

  signatureBox: {
    minHeight: 320,
    height: 340,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
  },
  signatureGuide: {
    position: "absolute",
    left: 20,
    right: 20,
    top: "55%",
    borderTopWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.35)",
    borderStyle: "dashed",
    zIndex: 1,
  },

  signatureCanvas: {
    flex: 1,
    width: "100%",
    height: "100%",
  },

  btnRow: {
    flexDirection: "row",
    gap: 12,
  },

  clearBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E7EB",
    paddingVertical: 14,
    borderRadius: 8,
  },

  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0077B6",
    paddingVertical: 14,
    borderRadius: 8,
  },

  confirmBtnDisabled: {
    opacity: 0.45,
  },

  clearText: {
    color: "#111827",
    fontWeight: "600",
  },

  confirmText: {
    color: "#fff",
    fontWeight: "600",
  },

});
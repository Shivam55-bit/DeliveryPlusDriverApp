import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  ActivityIndicator,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import API from "../services/api";

export default function SignatureScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef(null);

  const jobId = route?.params?.jobId;
  const isStartFlow = route?.params?.type === "start";

  // Customer Name from params or job
  const initialCustomerName =
    route?.params?.customerSignatureName ||
    route?.params?.customerName ||
    route?.params?.job?.customer?.name ||
    route?.params?.job?.customerName ||
    "";

  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [hasStroke, setHasStroke] = useState(false);
  const [saving, setSaving] = useState(false);

  // WebView HTML for zero-movement, zero-scroll signature canvas
  const signatureHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  * {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #FFFFFF;
    touch-action: none !important;
    overscroll-behavior: none !important;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
  #signature-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    touch-action: none !important;
    background: #FFFFFF;
  }
  #signature-canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none !important;
    background: #FFFFFF;
    cursor: crosshair;
  }
</style>
</head>
<body>
  <div id="signature-wrapper">
    <canvas id="signature-canvas"></canvas>
  </div>
  <script>
    (function() {
      var wrapper = document.getElementById('signature-wrapper');
      var canvas = document.getElementById('signature-canvas');
      var ctx = canvas.getContext('2d');
      var drawing = false;
      var hasStroke = false;
      var ratio = window.devicePixelRatio || 1;

      function resizeCanvas() {
        var rect = wrapper.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var dataUrl = canvas.toDataURL();
        canvas.width = Math.floor(rect.width * ratio);
        canvas.height = Math.floor(rect.height * ratio);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0F172A';
        if (dataUrl && dataUrl.startsWith('data:image/png') && dataUrl.length > 100) {
          var image = new Image();
          image.onload = function() {
            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.drawImage(image, 0, 0, rect.width, rect.height);
          };
          image.src = dataUrl;
        }
      }

      function getPoint(e) {
        var rect = canvas.getBoundingClientRect();
        var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        var clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        return { x: clientX - rect.left, y: clientY - rect.top };
      }

      function startDraw(e) {
        if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        drawing = true;
        var p = getPoint(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        if (!hasStroke) {
          hasStroke = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stroke' }));
        }
      }

      function moveDraw(e) {
        if (!drawing) return;
        var p = getPoint(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      function stopDraw(e) {
        if (!drawing) return;
        drawing = false;
      }

      // Pointer events
      canvas.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        try { canvas.setPointerCapture(e.pointerId); } catch(err){}
        startDraw(e);
      }, { passive: false });

      canvas.addEventListener('pointermove', function(e) {
        if (drawing) {
          e.preventDefault();
          e.stopPropagation();
          moveDraw(e);
        }
      }, { passive: false });

      canvas.addEventListener('pointerup', function(e) {
        if (drawing) {
          e.preventDefault();
          e.stopPropagation();
          stopDraw(e);
        }
      }, { passive: false });

      canvas.addEventListener('pointercancel', function(e) {
        if (drawing) {
          e.preventDefault();
          e.stopPropagation();
          stopDraw(e);
        }
      }, { passive: false });

      // Fallback touch events with preventDefault on window to stop screen scroll
      window.addEventListener('touchmove', function(e) {
        if (drawing) e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        startDraw(e);
      }, { passive: false });

      canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        e.stopPropagation();
        moveDraw(e);
      }, { passive: false });

      canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        stopDraw(e);
      }, { passive: false });

      window.addEventListener('resize', resizeCanvas);
      window.addEventListener('load', resizeCanvas);
      setTimeout(resizeCanvas, 50);

      window.clearCanvas = function() {
        if (ctx && canvas) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          ctx.beginPath();
          hasStroke = false;
        }
        return true;
      };

      window.saveCanvas = function() {
        if (canvas) {
          var dataUrl = canvas.toDataURL('image/png');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'save',
            data: dataUrl,
            hasStroke: hasStroke
          }));
        }
        return true;
      };

      function onMessageReceived(e) {
        try {
          var payload = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (payload && payload.type === 'clear') {
            window.clearCanvas();
          } else if (payload && payload.type === 'save') {
            window.saveCanvas();
          }
        } catch(err) {}
      }

      window.addEventListener('message', onMessageReceived);
      document.addEventListener('message', onMessageReceived);
    })();
  </script>
</body>
</html>`;

  const handleCanvasMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "stroke") {
        setHasStroke(true);
      } else if (msg.type === "save") {
        if (msg.data && msg.hasStroke) {
          handleSaveAndContinue(msg.data);
        } else {
          setSaving(false);
          Alert.alert(
            "Signature Required",
            "Please provide a signature before confirming."
          );
        }
      }
    } catch (e) {
      console.warn("Canvas message error:", e);
    }
  };

  const handleClearSignature = () => {
    setHasStroke(false);
    webviewRef.current?.injectJavaScript("window.clearCanvas && window.clearCanvas(); true;");
    webviewRef.current?.postMessage(JSON.stringify({ type: "clear" }));
  };

  const handleConfirmPress = () => {
    if (!customerName.trim() && !isStartFlow) {
      Alert.alert(
        "Customer Name Required",
        "Please enter the customer's full name."
      );
      return;
    }

    if (!hasStroke) {
      Alert.alert(
        "Signature Required",
        "Please sign inside the white signature canvas before confirming."
      );
      return;
    }

    setSaving(true);
    webviewRef.current?.injectJavaScript("window.saveCanvas && window.saveCanvas(); true;");
    webviewRef.current?.postMessage(JSON.stringify({ type: "save" }));
  };

  const handleSaveAndContinue = async (signatureBase64) => {
    try {
      if (isStartFlow) {
        // Driver Start Job Flow
        const targetJobId = jobId || route?.params?.id;
        if (!targetJobId) throw new Error("Missing Job ID");

        await API.post(`/jobs/${targetJobId}/start`, {
          signature: signatureBase64,
          driverSignature: signatureBase64,
        });

        Alert.alert("Success", "Job started successfully!");
        navigation.goBack();
        return;
      }

      // Customer End Job Flow: Return signature back to Complete & End Job screen
      const callback = route?.params?.onSignatureSaved;
      if (typeof callback === "function") {
        callback(signatureBase64, customerName.trim());
        navigation.goBack();
      } else {
        navigation.navigate("CompleteJob", {
          ...route.params,
          customerSignature: signatureBase64,
          customerEndSignature: signatureBase64,
          customerSignatureName: customerName.trim(),
          customerName: customerName.trim(),
        });
      }
    } catch (err) {
      console.error("[Signature] Error saving signature:", err);
      Alert.alert("Error", err?.message || "Failed to process signature");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

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
              {isStartFlow ? "Driver Signature" : "Customer Signature"}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {isStartFlow
                ? "Please sign below to confirm start."
                : `Job ID: #${jobId || "N/A"}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Dedicated Fixed Body (NO ScrollView to guarantee 100% fixed zero-shift screen) */}
      <View style={[styles.bodyContainer, { paddingBottom: insets.bottom + 14 }]}>
        {/* Customer Full Name Field */}
        {!isStartFlow && (
          <View style={styles.nameFieldContainer}>
            <Text style={styles.inputLabel}>
              Customer Full Name <Text style={styles.mandatoryAsterisk}>*</Text>
            </Text>
            <View style={styles.inputRow}>
              <Ionicons
                name="person-outline"
                size={18}
                color="#0088FF"
                style={{ marginLeft: 12 }}
              />
              <TextInput
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Enter customer's full name"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
              />
            </View>
          </View>
        )}

        {/* Signature Label & Instructions */}
        <View style={styles.instructionContainer}>
          <Text style={styles.signatureLabel}>
            {isStartFlow ? "Driver Signature" : "Customer Signature"}{" "}
            <Text style={styles.mandatoryAsterisk}>*</Text>
          </Text>
          <Text style={styles.instructionText}>
            Use your finger or stylus to sign inside the white box below:
          </Text>
        </View>

        {/* Large Signature Drawing Canvas Box */}
        <View style={styles.signatureCard}>
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

        {/* Clear & Redraw Signature Button */}
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClearSignature}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={17} color="#475569" />
          <Text style={styles.clearBtnText}>Clear & Redraw Signature</Text>
        </TouchableOpacity>

        {/* Confirm Signature Button */}
        <TouchableOpacity
          style={[styles.confirmBtnWrapper, saving && styles.confirmBtnDisabled]}
          onPress={handleConfirmPress}
          disabled={saving}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={["#0098FF", "#00C6FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmBtnGradient}
          >
            {saving ? (
              <View style={styles.btnContentRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.confirmBtnText}>Saving Signature...</Text>
              </View>
            ) : (
              <View style={styles.btnContentRow}>
                <Text style={styles.confirmBtnText}>Confirm Signature</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginLeft: 6 }}
                />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
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

  // Fixed Non-Scrolling Body
  bodyContainer: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: "#F4F6FA",
  },

  // Name Field
  nameFieldContainer: {
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    borderRadius: 10,
    height: 44,
  },
  textInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
    fontWeight: "500",
  },

  // Instruction
  instructionContainer: {
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  signatureLabel: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  instructionText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },

  // Large Signature Card
  signatureCard: {
    flex: 1,
    minHeight: 260,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  signatureGuide: {
    position: "absolute",
    left: 20,
    right: 20,
    top: "65%",
    borderTopWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.35)",
    borderStyle: "dashed",
    zIndex: 1,
  },
  signatureCanvas: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
  },

  // Clear Button
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginTop: 10,
    marginBottom: 10,
  },
  clearBtnText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },

  // Confirm Button
  confirmBtnWrapper: {
    height: 50,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#0088FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
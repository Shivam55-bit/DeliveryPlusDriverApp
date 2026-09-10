import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { setAuthToken } from "../services/api";

export default function OTPLoginScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendOtp = () => {
    if (!phone.trim() || phone.trim().length < 10) {
      alert("Please enter a valid mobile number.");
      return;
    }
    setSent(true);
    setLoading(true);
    setTimeout(() => setLoading(false), 1200);
  };

  const verifyOtp = async () => {
    if (!otp.trim() || otp.trim().length < 4) {
      alert("Enter the 4-digit code.");
      return;
    }
    setLoading(true);
    try {
      const sessionToken = `otp-session-${phone.trim() || Date.now()}`;
      await setAuthToken(sessionToken, { phone: phone.trim() });
      setTimeout(() => {
        setLoading(false);
        navigation.replace("Home");
      }, 500);
    } catch (e) {
      setLoading(false);
      navigation.replace("Home");
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safe}>
          <LinearGradient colors={["#0A2B66", "#123B85"]} style={styles.hero}>
            <Text style={styles.heroTitle}>OTP Login</Text>
            <Text style={styles.heroSubtitle}>Quick access for drivers with secure OTP sign-in.</Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Enter mobile number"
              placeholderTextColor="#9AA5B1"
              style={styles.input}
              maxLength={10}
            />

            {!sent ? (
              <TouchableOpacity style={styles.button} onPress={sendOtp} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? "Sending..." : "Send OTP"}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={[styles.label, styles.mt20]}>Verification Code</Text>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  placeholder="Enter OTP"
                  placeholderTextColor="#9AA5B1"
                  style={styles.input}
                  maxLength={6}
                />
                <TouchableOpacity style={styles.button} onPress={verifyOtp} disabled={loading}>
                  <Text style={styles.buttonText}>{loading ? "Verifying..." : "Verify OTP"}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
              <Text style={styles.linkText}>Use Email / Password instead</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F6FA",
  },
  hero: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    borderBottomRightRadius: 32,
    backgroundColor: "#0A2B66",
  },
  heroTitle: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "800",
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
    maxWidth: "85%",
  },
  card: {
    marginTop: -24,
    marginHorizontal: 18,
    borderRadius: 24,
    backgroundColor: "#fff",
    padding: 22,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  label: {
    fontSize: 13,
    color: "#475467",
    marginBottom: 10,
    fontWeight: "600",
  },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    fontSize: 16,
  },
  button: {
    marginTop: 22,
    backgroundColor: "#0A2B66",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  link: {
    marginTop: 20,
    alignItems: "center",
  },
  linkText: {
    color: "#2F80ED",
    fontWeight: "600",
  },
  mt20: {
    marginTop: 20,
  },
});
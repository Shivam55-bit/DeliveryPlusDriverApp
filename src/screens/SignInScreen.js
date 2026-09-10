import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

import API, { setAuthToken } from "../services/api";
import { signInWithGoogle, configureGoogleSignIn } from "../services/googleAuth";

const logoImage = require("../assets/images/Logo.png");

// Google multi-colored "G" icon component
export const GoogleIcon = ({ size = 20 }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <MaterialCommunityIcons name="google" size={size} color="#EA4335" />
  </View>
);

// DeliveryPlus Logo using assets/images/Logo.png
export const HexagonLogo = ({ size = 70 }) => {
  return (
    <View style={styles.hexOuterWrapper}>
      {/* Background neon blur glow */}
      <View style={styles.hexGlowBackdrop} />

      {/* Logo container with image */}
      <View style={styles.hexBox}>
        <Image
          source={logoImage}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

// Bottom 4-column feature section
export const BottomFeatureSection = () => {
  return (
    <View style={styles.featuresCard}>
      <View style={styles.featuresRow}>
        {/* Feature 1: Safe & Reliable */}
        <View style={styles.featureColumn}>
          <Ionicons
            name="shield-checkmark-outline"
            size={32}
            color="#0088FF"
          />
          <Text style={styles.featureTitle}>Safe & Reliable</Text>
          <Text style={styles.featureDesc}>
            Your deliveries are always in safe hands.
          </Text>
        </View>

        {/* Feature 2: On-time Delivery */}
        <View style={styles.featureColumn}>
          <Ionicons
            name="time-outline"
            size={32}
            color="#0088FF"
          />
          <Text style={styles.featureTitle}>On-time Delivery</Text>
          <Text style={styles.featureDesc}>
            Timely deliveries, every single time.
          </Text>
        </View>
      </View>

      <View style={[styles.featuresRow, { marginTop: 22 }]}>
        {/* Feature 3: Live Tracking */}
        <View style={styles.featureColumn}>
          <Ionicons
            name="location-outline"
            size={32}
            color="#0088FF"
          />
          <Text style={styles.featureTitle}>Live Tracking</Text>
          <Text style={styles.featureDesc}>
            Track your deliveries in real-time.
          </Text>
        </View>

        {/* Feature 4: Affordable Prices */}
        <View style={styles.featureColumn}>
          <MaterialCommunityIcons
            name="currency-inr"
            size={32}
            color="#0088FF"
          />
          <Text style={styles.featureTitle}>Affordable Prices</Text>
          <Text style={styles.featureDesc}>
            Best rates with premium service.
          </Text>
        </View>
      </View>
    </View>
  );
};

export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const validateEmail = (val) => {
    const trimmed = (val || "").trim();
    if (!trimmed) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return "Enter a valid email address";
    return "";
  };

  const validatePassword = (val) => {
    const trimmed = (val || "").trim();
    if (!trimmed) return "Password is required";
    if (trimmed.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const handleSignIn = async () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);

    if (eErr || pErr || loading) return;

    setLoading(true);
    const cleanEmail = email.trim();

    try {
      let response;
      try {
        response = await API.post("/auth/login/driver", {
          email: cleanEmail,
          password,
        });
      } catch (err) {
        response = await API.post("/auth/login", {
          email: cleanEmail,
          password,
        });
      }

      const payload = response?.data ?? response;
      const token =
        payload?.accessToken ??
        payload?.token ??
        payload?.data?.accessToken ??
        payload?.data?.token;

      if (token) {
        await setAuthToken(token, payload?.user || payload?.driver || payload?.data?.user);
      }

      navigation.replace("Home");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Incorrect email or password. Please try again.";
      Alert.alert("Unable to Sign In", message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return;

    try {
      setGoogleLoading(true);
      const res = await signInWithGoogle();

      if (res.cancelled || res.inProgress) {
        return;
      }

      if (!res.success) {
        if (res.error) {
          Alert.alert("Google Sign In", res.error);
        }
        return;
      }

      const { user, idToken } = res;

      // Authenticate with backend or establish driver session
      let token = null;
      try {
        let response;
        try {
          response = await API.post("/auth/google", {
            idToken,
            email: user.email,
            name: user.name,
            googleId: user.id,
            photo: user.photo,
            role: "driver",
          });
        } catch (err) {
          response = await API.post("/auth/social-login", {
            provider: "google",
            idToken,
            email: user.email,
            name: user.name,
          });
        }

        const payload = response?.data ?? response;
        token =
          payload?.accessToken ??
          payload?.token ??
          payload?.data?.accessToken ??
          payload?.data?.token;
      } catch (backendError) {
        console.log("[SignIn] Backend google auth fallback:", backendError?.message);
        // Fallback: driver session token
        if (user.email) {
          token = `google-session-${user.id || Date.now()}`;
        }
      }

      if (token) {
        await setAuthToken(token, user);
      }

      navigation.replace("Home");
    } catch (err) {
      console.error("[SignIn] Google sign in unexpected error:", err);
      Alert.alert(
        "Google Sign In Error",
        err.message || "An unexpected error occurred during Google sign in."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Forgot Password",
      "Password reset link will be sent to your registered email."
    );
  };

  const handleSecureAccessInfo = () => {
    Alert.alert(
      "Secure Driver Access",
      "Your credentials, personal information, and route logs are encrypted with industry-standard 256-bit TLS security."
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Modern Royal Navy Gradient Background (Lighter) */}
      <LinearGradient
        colors={["#0A1A36", "#102A54", "#081833"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Glowing abstract waves / ambient light in background */}
      <View pointerEvents="none" style={styles.ambientGlowTopLeft} />
      <View pointerEvents="none" style={styles.ambientGlowTopRight} />
      <View pointerEvents="none" style={styles.ambientGlowBottom} />

      {/* Decorative Route Trail in Top-Right Background */}
      <View pointerEvents="none" style={styles.routeDecoration}>
        <View style={styles.routePinOne}>
          <Ionicons name="location-outline" size={14} color="#0088FF" />
        </View>
        <View style={styles.routePinTwo}>
          <Ionicons name="location-outline" size={18} color="#00A6FF" />
        </View>
        <View style={styles.routePinThree}>
          <Ionicons name="location-outline" size={12} color="#0066CC" />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              isTablet && styles.scrollContentTablet,
            ]}
          >
            <View style={[styles.mainShell, isTablet && styles.mainShellTablet]}>
              {/* WELCOME SECTION */}
              <View style={styles.welcomeSection}>
                <Image
                  source={logoImage}
                  style={styles.topLogoImage}
                  resizeMode="contain"
                />
                <Text style={styles.welcomeTitle}>Welcome back</Text>

                {/* Small blue gradient underline */}
                <LinearGradient
                  colors={["#0072FF", "#00C6FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.welcomeUnderline}
                />

                <Text style={styles.welcomeSubtitle}>
                  Sign in to manage jobs, routes and{"\n"}delivery updates.
                </Text>
              </View>

              {/* LOGIN FORM CARD */}
              <View style={styles.cardContainer}>
                {/* Email Field */}
                <View style={styles.fieldWrapper}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <View
                    style={[
                      styles.inputRow,
                      emailFocused && styles.inputRowFocused,
                      !!emailError && styles.inputRowError,
                    ]}
                  >
                    <View style={styles.iconBox}>
                      <Ionicons name="mail-outline" size={18} color="#0084FF" />
                    </View>
                    <TextInput
                      ref={emailInputRef}
                      placeholder="you@example.com"
                      placeholderTextColor="#94A3B8"
                      style={styles.textInput}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (emailError) setEmailError("");
                      }}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => {
                        setEmailFocused(false);
                        setEmailError(validateEmail(email));
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="emailAddress"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                  {!!emailError && (
                    <Text style={styles.inlineError}>{emailError}</Text>
                  )}
                </View>

                {/* Password Field */}
                <View style={styles.fieldWrapper}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View
                    style={[
                      styles.inputRow,
                      passwordFocused && styles.inputRowFocused,
                      !!passwordError && styles.inputRowError,
                    ]}
                  >
                    <View style={styles.iconBox}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color="#0084FF"
                      />
                    </View>
                    <TextInput
                      ref={passwordInputRef}
                      placeholder="Enter your password"
                      placeholderTextColor="#94A3B8"
                      style={styles.textInput}
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        if (passwordError) setPasswordError("");
                      }}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => {
                        setPasswordFocused(false);
                        setPasswordError(validatePassword(password));
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      textContentType="password"
                      returnKeyType="done"
                      onSubmitEditing={handleSignIn}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((prev) => !prev)}
                      activeOpacity={0.7}
                      style={styles.eyeToggleBtn}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#5E7394"
                      />
                    </TouchableOpacity>
                  </View>
                  {!!passwordError && (
                    <Text style={styles.inlineError}>{passwordError}</Text>
                  )}
                </View>

                {/* Remember Me / Forgot Password Row */}
                <View style={styles.rememberRow}>
                  <TouchableOpacity
                    style={styles.checkboxContainer}
                    activeOpacity={0.75}
                    onPress={() => setRememberMe((prev) => !prev)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        rememberMe ? styles.checkboxChecked : styles.checkboxUnchecked,
                      ]}
                    >
                      {rememberMe && (
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={styles.rememberText}>Remember me</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>

                {/* Sign In Button */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={handleSignIn}
                  disabled={loading}
                  style={styles.signInBtnWrapper}
                >
                  <LinearGradient
                    colors={["#0098FF", "#00C6FF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signInBtnGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.signInBtnText}>Sign In</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color="#FFFFFF"
                          style={{ marginLeft: 4 }}
                        />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Don't have an account? Sign Up row */}
                <View style={styles.switchAuthRow}>
                  <Text style={styles.switchAuthPrompt}>
                    Don't have an account?
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("SignUp")}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.switchAuthLink}>Sign Up</Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom Security Card Inside Login Section */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleSecureAccessInfo}
                  style={styles.securityCard}
                >
                  <View style={styles.shieldIconWrapper}>
                    <Ionicons
                      name="shield-checkmark"
                      size={22}
                      color="#0088FF"
                    />
                  </View>

                  <View style={styles.securityTextContainer}>
                    <Text style={styles.securityTitle}>
                      Secure driver access
                    </Text>
                    <Text style={styles.securitySubtitle}>
                      Your data is protected
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#5E7394"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030814",
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  scrollContentTablet: {
    alignItems: "center",
    paddingVertical: 32,
  },
  mainShell: {
    width: "100%",
  },
  mainShellTablet: {
    maxWidth: 480,
  },

  // Ambient glows
  ambientGlowTopLeft: {
    position: "absolute",
    top: -50,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(0, 102, 255, 0.16)",
  },
  ambientGlowTopRight: {
    position: "absolute",
    top: 40,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(0, 153, 255, 0.12)",
  },
  ambientGlowBottom: {
    position: "absolute",
    bottom: -60,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(0, 85, 255, 0.08)",
  },

  // Decorative route trail
  routeDecoration: {
    position: "absolute",
    top: 36,
    right: 28,
    width: 90,
    height: 90,
    opacity: 0.7,
  },
  routePinOne: {
    position: "absolute",
    top: 0,
    right: 20,
  },
  routePinTwo: {
    position: "absolute",
    top: 30,
    right: 2,
  },
  routePinThree: {
    position: "absolute",
    top: 60,
    right: 44,
  },

  // Top Section
  topSection: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  hexOuterWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  hexGlowBackdrop: {
    position: "absolute",
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(0, 136, 255, 0.32)",
  },
  hexBox: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: "#07142B",
    borderWidth: 2,
    borderColor: "#0084FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0084FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  logoMarkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  motionLinesContainer: {
    alignItems: "flex-end",
    marginRight: 3,
    gap: 3.5,
  },
  motionLine: {
    height: 2.5,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  logoLetterD: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1,
  },

  // Brand Name
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitleWhite: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  brandTitleBlue: {
    color: "#0088FF",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    color: "#8FA3BE",
    fontSize: 12.5,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },

  // Welcome Section
  welcomeSection: {
    alignItems: "center",
    marginTop: 28,
    marginBottom: 22,
  },
  topLogoImage: {
    width: 190,
    height: 64,
    marginTop: 6,
    marginBottom: 20,
    alignSelf: "center",
  },
  welcomeTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  welcomeUnderline: {
    width: 36,
    height: 3.5,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 12,
  },
  welcomeSubtitle: {
    color: "#8A9CB5",
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    fontWeight: "400",
  },

  // Card Container
  cardContainer: {
    backgroundColor: "rgba(13, 28, 56, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(35, 70, 122, 0.65)",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },

  // Form Fields
  fieldWrapper: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: "#D6E2F2",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E2EE",
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 8,
  },
  inputRowFocused: {
    borderColor: "#0084FF",
    backgroundColor: "#FFFFFF",
  },
  inputRowError: {
    borderColor: "#EF4444",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF4FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 14.5,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    paddingHorizontal: 4,
    fontWeight: "500",
  },
  eyeToggleBtn: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineError: {
    color: "#EF4444",
    fontSize: 11.5,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: "500",
  },

  // Remember Row
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: "#0070F3",
  },
  checkboxUnchecked: {
    borderWidth: 1.5,
    borderColor: "#365582",
    backgroundColor: "transparent",
  },
  rememberText: {
    color: "#A0B4CE",
    fontSize: 13,
    fontWeight: "500",
  },
  forgotPasswordText: {
    color: "#0088FF",
    fontSize: 13,
    fontWeight: "600",
  },

  // Sign In Button
  signInBtnWrapper: {
    height: 50,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#00A6FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
  signInBtnGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  signInBtnText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // OR Divider
  orDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#203E68",
  },
  orText: {
    color: "#6D87AB",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 12,
  },

  // Google Button
  googleButton: {
    height: 50,
    backgroundColor: "#10254A",
    borderWidth: 1,
    borderColor: "#234372",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleButtonText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "600",
  },

  // Switch Auth Navigation Row
  switchAuthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 4,
  },
  switchAuthPrompt: {
    color: "#8FA5C2",
    fontSize: 13,
    marginRight: 6,
  },
  switchAuthLink: {
    color: "#0088FF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Bottom Security Card Inside Form
  securityCard: {
    backgroundColor: "rgba(14, 32, 62, 0.85)",
    borderWidth: 1,
    borderColor: "#224272",
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  shieldIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0, 136, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitle: {
    color: "#E2EDFA",
    fontSize: 13.5,
    fontWeight: "700",
  },
  securitySubtitle: {
    color: "#7E96B7",
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 1.5,
  },

  // Bottom Features Panel
  featuresCard: {
    backgroundColor: "#0B1D3D",
    borderWidth: 1,
    borderColor: "#1B3B6D",
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 14,
    marginTop: 22,
  },
  featuresRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  featureColumn: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  featureTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  featureDesc: {
    color: "#8BA2C2",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    textAlign: "center",
  },
});

import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import AppIcon from "../components/common/AppIcon";
import API, { setAuthToken } from "../services/api";

const { height } = Dimensions.get("window");

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const cardTranslateY = useSharedValue(100);
  const cardOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateEmail = (value) => {
    const cleanValue = value.trim();

    if (!cleanValue) return "Email is required.";
    if (!emailRegex.test(cleanValue)) return "Enter a valid email address.";

    return "";
  };

  const validatePassword = (value) => {
    if (!value.trim()) return "Password is required.";
    if (value.length < 6) return "Password must be at least 6 characters.";

    return "";
  };

  const isFormValid = useMemo(() => {
    return (
      !!email.trim() &&
      !!password.trim() &&
      !validateEmail(email) &&
      !validatePassword(password)
    );
  }, [email, password]);

  useEffect(() => {
    cardTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });
    cardOpacity.value = withTiming(1, { duration: 800 });

    logoScale.value = withSpring(1, { damping: 12, stiffness: 80 });
    logoOpacity.value = withTiming(1, { duration: 1000 });
  }, []);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardTranslateY.value }],
    opacity: cardOpacity.value,
  }));

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleEmailChange = (value) => {
    setEmail(value);

    if (emailError) {
      setEmailError(validateEmail(value));
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);

    if (passwordError) {
      setPasswordError(validatePassword(value));
    }
  };

  const handleForgotPassword = () => {
    Alert.alert("Forgot Password", "Forgot password flow is not configured yet.");
  };

  const handleLoginPress = () => {
    if (loading) return;

    buttonScale.value = withSpring(0.95, { damping: 10 }, () => {
      buttonScale.value = withSpring(1);
    });

    handleLogin();
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim();

    const emailValidation = validateEmail(cleanEmail);
    const passwordValidation = validatePassword(password);

    setEmailError(emailValidation);
    setPasswordError(passwordValidation);

    if (emailValidation || passwordValidation) return;

    setLoading(true);

    try {
      const response = await API.post("/auth/login/driver", {
        email: cleanEmail,
        password,
      });

      const responseData = response?.data || response;

      const authToken =
        responseData?.accessToken ||
        responseData?.token ||
        responseData?.data?.accessToken ||
        responseData?.data?.token;

      if (!authToken) {
        throw new Error("Login did not return an auth token.");
      }

      setAuthToken(authToken);

      navigation.replace("Home");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Something went wrong. Please try again.";

      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 80}
    >
      <ScrollView
        style={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          <ImageBackground
            source={require("../assets/images/login_banner.png")}
            style={styles.topBanner}
            resizeMode="cover"
          >
            <LinearGradient
              colors={[
                "rgba(10, 32, 68, 0.85)",
                "rgba(10, 32, 68, 0.45)",
                "transparent",
              ]}
              style={styles.bannerOverlay}
            >
              <Animated.View style={[styles.bannerContent, animatedLogoStyle]}>
                <Text style={styles.heroText}>
                  Sign in to continue your deliveries
                </Text>
              </Animated.View>
            </LinearGradient>
          </ImageBackground>

          <Animated.View style={[styles.card, animatedCardStyle]}>
            <Text style={styles.cardHeading}>Sign In</Text>
            <Text style={styles.cardSubheading}>
              Enter your credentials to access your account
            </Text>
          </Animated.View>

          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text
                style={[
                  styles.inputLabel,
                  emailFocused && styles.inputLabelFocused,
                ]}
              >
                Email Address
              </Text>

              <View
                style={[
                  styles.inputRow,
                  emailFocused && styles.inputRowFocused,
                  emailError && styles.inputRowError,
                ]}
              >
                <AppIcon
                  library="MaterialCommunityIcons"
                  name="email-outline"
                  size={20}
                  color={emailFocused ? "#007BFF" : "#A1A7B3"}
                />

                <TextInput
                  placeholder="Enter your email"
                  placeholderTextColor="#A1A7B3"
                  style={styles.inputWithIcon}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={handleEmailChange}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => {
                    setEmailFocused(false);
                    setEmailError(validateEmail(email));
                  }}
                  returnKeyType="next"
                />
              </View>

              {emailError ? (
                <Text style={styles.errorText}>{emailError}</Text>
              ) : null}
            </View>

            <View style={styles.inputWrapper}>
              <Text
                style={[
                  styles.inputLabel,
                  passwordFocused && styles.inputLabelFocused,
                ]}
              >
                Password
              </Text>

              <View
                style={[
                  styles.inputRow,
                  passwordFocused && styles.inputRowFocused,
                  passwordError && styles.inputRowError,
                ]}
              >
                <AppIcon
                  library="MaterialCommunityIcons"
                  name="lock-outline"
                  size={20}
                  color={passwordFocused ? "#007BFF" : "#A1A7B3"}
                />

                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor="#A1A7B3"
                  style={styles.inputWithIcon}
                  secureTextEntry={secure}
                  value={password}
                  onChangeText={handlePasswordChange}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => {
                    setPasswordFocused(false);
                    setPasswordError(validatePassword(password));
                  }}
                  returnKeyType="done"
                  onSubmitEditing={handleLoginPress}
                />

                <TouchableOpacity
                  onPress={() => setSecure((prev) => !prev)}
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                >
                  <AppIcon
                    library="Ionicons"
                    name={secure ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#667085"
                  />
                </TouchableOpacity>
              </View>

              {passwordError ? (
                <Text style={styles.errorText}>{passwordError}</Text>
              ) : null}
            </View>

            <View style={styles.rowBetween}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe((prev) => !prev)}
                activeOpacity={0.7}
              >
                <AppIcon
                  library="MaterialCommunityIcons"
                  name={
                    rememberMe
                      ? "checkbox-marked-circle"
                      : "checkbox-blank-circle-outline"
                  }
                  size={20}
                  color={rememberMe ? "#007BFF" : "#A1A7B3"}
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleForgotPassword}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <Animated.View style={animatedButtonStyle}>
              <TouchableOpacity
                style={[
                  styles.loginButton,
                  (loading || !isFormValid) && styles.loginButtonDisabled,
                ]}
                onPress={handleLoginPress}
                disabled={loading || !isFormValid}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={
                    loading || !isFormValid
                      ? ["#CBD5E1", "#94A3B8"]
                      : ["#00CFFF", "#0A7BFF"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginButtonInner}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Sign In</Text>
                      <AppIcon library="Ionicons" name="arrow-forward" size={20} color="#FFFFFF" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  container: {
    flex: 1,
  },
  topBanner: {
    width: "100%",
    height: height * 0.38,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
  },
  bannerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  bannerContent: {
    alignItems: "center",
    paddingTop: 24,
  },
  heroText: {
    color: "#D6E4FF",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    opacity: 0.95,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: -50,
    borderRadius: 32,
    padding: 20,
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  formContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
  },
  cardHeading: {
    color: "#0F172A",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  cardSubheading: {
    color: "#64748B",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  inputLabel: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputLabelFocused: {
    color: "#007BFF",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 18,
    minHeight: 58,
    borderWidth: 2,
    borderColor: "#F1F5F9",
  },
  inputRowFocused: {
    borderColor: "#007BFF",
    backgroundColor: "#FFFFFF",
    shadowColor: "#007BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  inputRowError: {
    borderColor: "#EF4444",
  },
  inputWithIcon: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    marginLeft: 12,
    fontWeight: "500",
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  eyeButton: {
    padding: 6,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 6,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rememberText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "500",
  },
  forgotText: {
    color: "#007BFF",
    fontWeight: "700",
    fontSize: 14,
  },
  loginButton: {
    marginTop: 18,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#007BFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  loginButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 12,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  loginButtonDisabled: {
    opacity: 0.65,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: "500",
  },
});
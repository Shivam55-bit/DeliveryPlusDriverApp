import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import AppIcon from "../components/common/AppIcon";
import API from "../services/api";

const COLORS = {
  navy950: "#06172D",
  navy900: "#082340",
  navy800: "#0B3159",
  blue600: "#0B7FC1",
  blue500: "#159DE3",
  white: "#FFFFFF",
  surface: "#FFFFFF",
  background: "#F3F6FB",
  text: "#0F172A",
  muted: "#64748B",
  placeholder: "#9AA8BC",
  border: "#DDE6F0",
  inputBackground: "#F8FAFD",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  success: "#16A34A",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-Z\s.'-]{2,50}$/;

export default function SignUpScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const isCompactPhone = width < 390 || height < 760;
  const isTablet = width >= 768;

  const fullNameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const [fullNameFocused, setFullNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  const [fullNameError, setFullNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const cardTranslateY = useSharedValue(36);
  const cardOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    cardTranslateY.value = withSpring(0, {
      damping: 16,
      stiffness: 110,
    });
    cardOpacity.value = withTiming(1, { duration: 550 });

    const focusTimer = setTimeout(() => {
      fullNameInputRef.current?.focus();
    }, 150);

    return () => clearTimeout(focusTimer);
  }, [cardOpacity, cardTranslateY]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const validateFullName = (value) => {
    const cleanValue = String(value || "").trim();

    if (!cleanValue) return "Full name is required.";
    if (!nameRegex.test(cleanValue)) {
      return "Enter a valid name using 2–50 characters.";
    }

    return "";
  };

  const validateEmail = (value) => {
    const cleanValue = String(value || "").trim().toLowerCase();

    if (!cleanValue) return "Email address is required.";
    if (!emailRegex.test(cleanValue)) {
      return "Enter a valid email address.";
    }

    return "";
  };

  const validatePassword = (value) => {
    if (!value) return "Password is required.";
    if (value.length < 8) {
      return "Password must contain at least 8 characters.";
    }

    return "";
  };

  const validateConfirmPassword = (value) => {
    if (!value) return "Please confirm your password.";
    if (value !== password) return "Passwords do not match.";

    return "";
  };

  const isFormValid = useMemo(() => {
    return (
      !validateFullName(fullName) &&
      !validateEmail(email) &&
      !validatePassword(password) &&
      !validateConfirmPassword(confirmPassword)
    );
  }, [confirmPassword, email, fullName, password]);

  const clearApiError = () => {
    if (apiError) setApiError("");
  };

  const handleFullNameChange = (value) => {
    setFullName(value);
    clearApiError();

    if (fullNameError) {
      setFullNameError(validateFullName(value));
    }
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    clearApiError();

    if (emailError) {
      setEmailError(validateEmail(value));
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    clearApiError();

    if (passwordError) {
      setPasswordError(validatePassword(value));
    }

    if (confirmPassword) {
      setConfirmPasswordError(
        value === confirmPassword ? "" : "Passwords do not match."
      );
    }
  };

  const handleConfirmPasswordChange = (value) => {
    setConfirmPassword(value);
    clearApiError();

    if (confirmPasswordError) {
      setConfirmPasswordError(validateConfirmPassword(value));
    }
  };

  const getErrorMessage = (error) => {
    return (
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Registration failed. Please try again."
    );
  };

  const handleSignUp = async () => {
    if (loading) return;

    const nameValidation = validateFullName(fullName);
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);
    const confirmValidation = validateConfirmPassword(confirmPassword);

    setFullNameError(nameValidation);
    setEmailError(emailValidation);
    setPasswordError(passwordValidation);
    setConfirmPasswordError(confirmValidation);
    setApiError("");

    if (
      nameValidation ||
      emailValidation ||
      passwordValidation ||
      confirmValidation
    ) {
      return;
    }

    buttonScale.value = withSpring(0.97, { damping: 10 }, () => {
      buttonScale.value = withSpring(1);
    });

    setLoading(true);

    try {
      await API.post("/register", {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      Alert.alert(
        "Account created",
        "Registration successful. Please sign in to continue.",
        [
          {
            text: "Sign In",
            onPress: () => navigation.replace("Login"),
          },
        ]
      );
    } catch (error) {
      const message = getErrorMessage(error);
      setApiError(message);
      Alert.alert("Registration failed", message);
    } finally {
      setLoading(false);
    }
  };

  const getInputStyle = (focused, error) => [
    styles.inputField,
    focused && styles.inputFieldFocused,
    Boolean(error) && styles.inputFieldError,
  ];

  const getIconColor = (focused, error) => {
    if (error) return COLORS.danger;
    if (focused) return COLORS.blue600;
    return COLORS.muted;
  };

  return (
    <LinearGradient
      colors={[COLORS.navy950, COLORS.navy900, COLORS.navy800]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right", "bottom"]}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.navy950}
          translucent={false}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              isTablet && styles.scrollContentTablet,
              {
                paddingBottom: Math.max(28, insets.bottom + 20),
              },
            ]}
          >
            <View
              style={[
                styles.contentShell,
                isTablet && styles.contentShellTablet,
              ]}
            >
              <View
                style={[
                  styles.hero,
                  isCompactPhone && styles.heroCompact,
                  isTablet && styles.heroTablet,
                ]}
              >
                <View
                  style={styles.heroImage}
                >
                  <View style={styles.heroImageFallback}>
                    <AppIcon
                      library="MaterialCommunityIcons"
                      name="truck-fast-outline"
                      size={62}
                      color="rgba(255,255,255,0.92)"
                    />

                    <Text style={styles.heroBrand}>DELIVERY PLUS</Text>
                    <Text style={styles.heroTagline}>
                      Trusted transit at affordable prices
                    </Text>
                  </View>
                </View>

                <View pointerEvents="none" style={styles.heroCircleOne} />
                <View pointerEvents="none" style={styles.heroCircleTwo} />

                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>DRIVER REGISTRATION</Text>

                  <Text
                    style={[
                      styles.heroTitle,
                      isCompactPhone && styles.heroTitleCompact,
                    ]}
                  >
                    Join our delivery network
                  </Text>

                  <Text style={styles.heroSubtitle}>
                    Create your driver account and start receiving jobs.
                  </Text>
                </View>
              </View>

              <Animated.View
                style={[
                  styles.formCard,
                  isCompactPhone && styles.formCardCompact,
                  isTablet && styles.formCardTablet,
                  animatedCardStyle,
                ]}
              >
                <View style={styles.cardHeading}>
                  <Text
                    style={[
                      styles.cardTitle,
                      isCompactPhone && styles.cardTitleCompact,
                    ]}
                  >
                    Create account
                  </Text>

                  <Text style={styles.cardSubtitle}>
                    Enter your details to register as a Delivery Plus driver.
                  </Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Full name</Text>

                  <View
                    style={getInputStyle(fullNameFocused, fullNameError)}
                  >
                    <View style={styles.inputIconBox}>
                      <AppIcon
                        library="MaterialCommunityIcons"
                        name="account-outline"
                        size={21}
                        color={getIconColor(fullNameFocused, fullNameError)}
                      />
                    </View>

                    <TextInput
                      ref={fullNameInputRef}
                      style={styles.textInput}
                      placeholder="Enter your full name"
                      placeholderTextColor={COLORS.placeholder}
                      autoCapitalize="words"
                      autoCorrect={false}
                      textContentType="name"
                      autoComplete="name"
                      value={fullName}
                      onChangeText={handleFullNameChange}
                      onFocus={() => setFullNameFocused(true)}
                      onBlur={() => {
                        setFullNameFocused(false);
                        setFullNameError(validateFullName(fullName));
                      }}
                      returnKeyType="next"
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                      blurOnSubmit={false}
                      editable={!loading}
                    />
                  </View>

                  {fullNameError ? (
                    <Text style={styles.errorMessage}>{fullNameError}</Text>
                  ) : null}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Email address</Text>

                  <View style={getInputStyle(emailFocused, emailError)}>
                    <View style={styles.inputIconBox}>
                      <AppIcon
                        library="MaterialCommunityIcons"
                        name="email-outline"
                        size={21}
                        color={getIconColor(emailFocused, emailError)}
                      />
                    </View>

                    <TextInput
                      ref={emailInputRef}
                      style={styles.textInput}
                      placeholder="Enter your email"
                      placeholderTextColor={COLORS.placeholder}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="emailAddress"
                      autoComplete="email"
                      value={email}
                      onChangeText={handleEmailChange}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => {
                        setEmailFocused(false);
                        setEmailError(validateEmail(email));
                      }}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                      blurOnSubmit={false}
                      editable={!loading}
                    />
                  </View>

                  {emailError ? (
                    <Text style={styles.errorMessage}>{emailError}</Text>
                  ) : null}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Password</Text>

                  <View style={getInputStyle(passwordFocused, passwordError)}>
                    <View style={styles.inputIconBox}>
                      <AppIcon
                        library="MaterialCommunityIcons"
                        name="lock-outline"
                        size={21}
                        color={getIconColor(passwordFocused, passwordError)}
                      />
                    </View>

                    <TextInput
                      ref={passwordInputRef}
                      style={styles.textInput}
                      placeholder="Minimum 8 characters"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={handlePasswordChange}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => {
                        setPasswordFocused(false);
                        setPasswordError(validatePassword(password));
                      }}
                      returnKeyType="next"
                      textContentType="newPassword"
                      autoComplete="new-password"
                      onSubmitEditing={() =>
                        confirmPasswordInputRef.current?.focus()
                      }
                      blurOnSubmit={false}
                      editable={!loading}
                    />

                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowPassword((previous) => !previous)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      <AppIcon
                        library="Ionicons"
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={21}
                        color={COLORS.muted}
                      />
                    </TouchableOpacity>
                  </View>

                  {passwordError ? (
                    <Text style={styles.errorMessage}>{passwordError}</Text>
                  ) : null}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Confirm password</Text>

                  <View
                    style={getInputStyle(
                      confirmPasswordFocused,
                      confirmPasswordError
                    )}
                  >
                    <View style={styles.inputIconBox}>
                      <AppIcon
                        library="MaterialCommunityIcons"
                        name="lock-check-outline"
                        size={21}
                        color={getIconColor(
                          confirmPasswordFocused,
                          confirmPasswordError
                        )}
                      />
                    </View>

                    <TextInput
                      ref={confirmPasswordInputRef}
                      style={styles.textInput}
                      placeholder="Re-enter your password"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={handleConfirmPasswordChange}
                      onFocus={() => setConfirmPasswordFocused(true)}
                      onBlur={() => {
                        setConfirmPasswordFocused(false);
                        setConfirmPasswordError(
                          validateConfirmPassword(confirmPassword)
                        );
                      }}
                      returnKeyType="done"
                      textContentType="newPassword"
                      autoComplete="new-password"
                      onSubmitEditing={handleSignUp}
                      editable={!loading}
                    />

                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() =>
                        setShowConfirmPassword((previous) => !previous)
                      }
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      <AppIcon
                        library="Ionicons"
                        name={
                          showConfirmPassword
                            ? "eye-off-outline"
                            : "eye-outline"
                        }
                        size={21}
                        color={COLORS.muted}
                      />
                    </TouchableOpacity>
                  </View>

                  {confirmPasswordError ? (
                    <Text style={styles.errorMessage}>
                      {confirmPasswordError}
                    </Text>
                  ) : null}
                </View>

                {apiError ? (
                  <View style={styles.apiErrorBox}>
                    <AppIcon
                      library="Ionicons"
                      name="alert-circle-outline"
                      size={19}
                      color={COLORS.danger}
                    />

                    <Text style={styles.apiErrorText}>{apiError}</Text>
                  </View>
                ) : null}

                <Animated.View style={animatedButtonStyle}>
                  <TouchableOpacity
                    style={[
                      styles.signUpButton,
                      (!isFormValid || loading) && styles.signUpButtonDisabled,
                    ]}
                    onPress={handleSignUp}
                    disabled={!isFormValid || loading}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="Create account"
                  >
                    <LinearGradient
                      colors={
                        isFormValid && !loading
                          ? [COLORS.blue600, COLORS.blue500]
                          : ["#CBD5E1", "#D8E0EB"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.signUpButtonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator
                          color={COLORS.white}
                          size="small"
                        />
                      ) : (
                        <View style={styles.buttonContent}>
                          <Text style={styles.signUpButtonText}>
                            Create Account
                          </Text>

                          <AppIcon
                            library="Ionicons"
                            name="arrow-forward"
                            size={20}
                            color={COLORS.white}
                          />
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                <View style={styles.signInContainer}>
                  <Text style={styles.signInText}>
                    Already have an account?
                  </Text>

                  <TouchableOpacity
                    onPress={() => navigation.replace("Login")}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Go to sign in"
                  >
                    <Text style={styles.signInLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.securityNote}>
                  <AppIcon
                    library="Ionicons"
                    name="shield-checkmark-outline"
                    size={17}
                    color={COLORS.success}
                  />

                  <Text style={styles.securityText}>
                    Secure driver registration
                  </Text>
                </View>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
  },

  flex: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingTop: 12,
  },

  scrollContentTablet: {
    justifyContent: "center",
    paddingVertical: 32,
  },

  contentShell: {
    width: "100%",
  },

  contentShellTablet: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
  },

  hero: {
    height: 250,
    marginHorizontal: 16,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: COLORS.navy900,
    paddingHorizontal: 22,
    paddingVertical: 22,
    justifyContent: "flex-end",
  },

  heroCompact: {
    height: 220,
    marginHorizontal: 12,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },

  heroTablet: {
    height: 310,
    marginHorizontal: 24,
  },

  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },

  heroImageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.13,
  },

  heroBrand: {
    marginTop: 8,
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 2.2,
  },

  heroTagline: {
    marginTop: 4,
    color: COLORS.white,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  heroCircleOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -58,
    top: -72,
    backgroundColor: "rgba(21,157,227,0.18)",
  },

  heroCircleTwo: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    left: -40,
    bottom: -50,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  heroCopy: {
    zIndex: 2,
    maxWidth: 320,
  },

  heroEyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
  },

  heroTitle: {
    marginTop: 7,
    color: COLORS.white,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  heroTitleCompact: {
    fontSize: 25,
    lineHeight: 31,
  },

  heroSubtitle: {
    marginTop: 7,
    maxWidth: 300,
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },

  formCard: {
    marginTop: -24,
    marginHorizontal: 16,
    marginBottom: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    shadowColor: "#020C18",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },

  formCardCompact: {
    marginHorizontal: 12,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 20,
    borderRadius: 26,
  },

  formCardTablet: {
    width: "72%",
    maxWidth: 620,
    alignSelf: "center",
    marginTop: -38,
    paddingHorizontal: 34,
    paddingVertical: 32,
  },

  cardHeading: {
    marginBottom: 22,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  cardTitleCompact: {
    fontSize: 26,
    lineHeight: 32,
  },

  cardSubtitle: {
    marginTop: 8,
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },

  inputContainer: {
    marginBottom: 16,
  },

  inputLabel: {
    marginBottom: 8,
    color: COLORS.text,
    fontSize: 13.5,
    fontWeight: "800",
  },

  inputField: {
    minHeight: 58,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    flexDirection: "row",
    alignItems: "center",
  },

  inputFieldFocused: {
    borderColor: COLORS.blue500,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.blue500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },

  inputFieldError: {
    borderColor: "#F87171",
    backgroundColor: "#FFF8F8",
  },

  inputIconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#E5F3FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },

  textInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "500",
  },

  eyeIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  errorMessage: {
    marginTop: 7,
    marginLeft: 4,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "600",
  },

  apiErrorBox: {
    marginBottom: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  apiErrorText: {
    flex: 1,
    marginLeft: 8,
    color: COLORS.danger,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },

  signUpButton: {
    height: 58,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: COLORS.blue600,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },

  signUpButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },

  signUpButtonGradient: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  signUpButtonText: {
    marginRight: 9,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
  },

  signInContainer: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  signInText: {
    marginRight: 6,
    color: COLORS.muted,
    fontSize: 13.5,
    fontWeight: "500",
  },

  signInLink: {
    color: COLORS.blue600,
    fontSize: 13.5,
    fontWeight: "900",
  },

  securityNote: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  securityText: {
    marginLeft: 7,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
  },
});

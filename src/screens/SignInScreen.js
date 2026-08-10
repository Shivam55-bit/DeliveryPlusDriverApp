import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  ImageBackground,
  Keyboard,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";

import API, { setAuthToken } from "../services/api";

const COLORS = {
  navy950: "#06172D",
  navy900: "#082340",
  navy800: "#0B3159",
  blue600: "#0B7FC1",
  blue500: "#159DE3",

  white: "#FFFFFF",
  surface: "#FFFFFF",
  text: "#0E1B31",
  body: "#65748B",
  placeholder: "#9AA8BC",
  border: "#DDE6F0",
  inputBackground: "#F8FAFD",

  success: "#16A34A",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
};

const SignInScreen = ({ navigation }) => {
  const passwordInputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const isCompactPhone = width < 390 || height < 760;
  const isTablet = width >= 768;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      () => setKeyboardVisible(true)
    );

    const hideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const normalizedEmail = email.trim();

  const emailError =
    emailTouched && normalizedEmail.length === 0;

  const passwordError =
    passwordTouched && password.length === 0;

  const canSubmit = useMemo(
    () =>
      normalizedEmail.length > 0 &&
      password.length > 0 &&
      !loading,
    [normalizedEmail, password, loading]
  );

  const handleSignIn = async () => {
    setEmailTouched(true);
    setPasswordTouched(true);
    setApiError("");

    if (
      normalizedEmail.length === 0 ||
      password.length === 0 ||
      loading
    ) {
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    try {
      const response = await API.post("/auth/login", {
        email: normalizedEmail,
        password,
      });

      const payload = response?.data ?? response;

      const accessToken =
        payload?.accessToken ??
        payload?.token ??
        payload?.data?.accessToken ??
        payload?.data?.token;

      if (!accessToken) {
        setApiError(
          payload?.message ||
            "Login failed. Please check your credentials."
        );
        return;
      }

      await Promise.resolve(setAuthToken(accessToken));
      navigation.replace("Home");
    } catch (error) {
      const status = error?.response?.status;
      const responseMessage =
        error?.response?.data?.message;

      const message =
        status === 401
          ? "Incorrect email or password."
          : responseMessage ||
            error?.message ||
            "Unable to sign in. Please try again.";

      setApiError(message);
      Alert.alert("Unable to sign in", message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    navigation.navigate("SignUp");
  };

  return (
    <LinearGradient
      colors={[
        COLORS.navy950,
        COLORS.navy900,
        COLORS.navy800,
      ]}
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

        <View pointerEvents="none" style={styles.decorOne} />
        <View pointerEvents="none" style={styles.decorTwo} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={[
              styles.scrollContent,
              isTablet && styles.scrollContentTablet,
              {
                paddingBottom: keyboardVisible
                  ? 18
                  : Math.max(28, insets.bottom + 20),
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
                  styles.heroFrame,
                  isCompactPhone && styles.heroFrameCompact,
                  isTablet && styles.heroFrameTablet,
                ]}
              >
                <ImageBackground
                  source={require("../assets/images/signin_banner_image.png")}
                  resizeMode="cover"
                  style={styles.heroImageContainer}
                  imageStyle={styles.heroImage}
                >
                  <LinearGradient
                    colors={[
                      "rgba(2,18,38,0.00)",
                      "rgba(2,18,38,0.08)",
                      "rgba(2,18,38,0.24)",
                    ]}
                    locations={[0, 0.66, 1]}
                    style={styles.heroOverlay}
                  />
                </ImageBackground>
              </View>

              <Animated.View
                style={[
                  styles.card,
                  isCompactPhone && styles.cardCompact,
                  isTablet && styles.cardTablet,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={styles.headingSection}>
                  <Text
                    style={[
                      styles.title,
                      isCompactPhone && styles.titleCompact,
                    ]}
                  >
                    Welcome back
                  </Text>

                  <Text style={styles.subtitle}>
                    Sign in to manage jobs, routes and delivery updates.
                  </Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>

                  <View
                    style={[
                      styles.inputBox,
                      emailError && styles.errorBorder,
                    ]}
                  >
                    <View style={styles.inputIconWrap}>
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color={COLORS.blue600}
                      />
                    </View>

                    <TextInput
                      placeholder="you@example.com"
                      placeholderTextColor={COLORS.placeholder}
                      style={styles.input}
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (apiError) setApiError("");
                      }}
                      onBlur={() => setEmailTouched(true)}
                      keyboardType="email-address"
                      returnKeyType="next"
                      textContentType="emailAddress"
                      autoComplete="email"
                      autoCorrect={false}
                      autoCapitalize="none"
                      onSubmitEditing={() =>
                        passwordInputRef.current?.focus()
                      }
                      blurOnSubmit={false}
                    />
                  </View>

                  {emailError ? (
                    <Text style={styles.errorText}>
                      Please enter your email.
                    </Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>

                  <View
                    style={[
                      styles.inputBox,
                      passwordError && styles.errorBorder,
                    ]}
                  >
                    <View style={styles.inputIconWrap}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={COLORS.blue600}
                      />
                    </View>

                    <TextInput
                      ref={passwordInputRef}
                      placeholder="Enter your password"
                      placeholderTextColor={COLORS.placeholder}
                      style={styles.input}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (apiError) setApiError("");
                      }}
                      onBlur={() => setPasswordTouched(true)}
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      textContentType="password"
                      autoComplete="password"
                      onSubmitEditing={handleSignIn}
                    />

                    <TouchableOpacity
                      style={styles.eyeButton}
                      activeOpacity={0.75}
                      onPress={() =>
                        setShowPassword((previous) => !previous)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      <Ionicons
                        name={
                          showPassword
                            ? "eye-off-outline"
                            : "eye-outline"
                        }
                        size={21}
                        color={COLORS.body}
                      />
                    </TouchableOpacity>
                  </View>

                  {passwordError ? (
                    <Text style={styles.errorText}>
                      Password cannot be empty.
                    </Text>
                  ) : null}
                </View>

                {apiError ? (
                  <View style={styles.apiErrorBox}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={19}
                      color={COLORS.danger}
                    />

                    <Text style={styles.apiErrorText}>
                      {apiError}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleSignIn}
                  disabled={!canSubmit}
                  style={[
                    styles.signInButton,
                    !canSubmit && styles.signInButtonDisabled,
                  ]}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                >
                  <LinearGradient
                    colors={
                      canSubmit
                        ? [COLORS.blue600, COLORS.blue500]
                        : ["#CBD5E1", "#D8E0EB"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signInGradient}
                  >
                    {loading ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.white}
                      />
                    ) : (
                      <>
                        <Text style={styles.signInText}>
                          Sign In
                        </Text>

                        <Ionicons
                          name="arrow-forward"
                          size={20}
                          color={COLORS.white}
                        />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.signUpRow}>
                  <Text style={styles.signUpPrompt}>
                    Don’t have an account?
                  </Text>

                  <TouchableOpacity
                    onPress={handleSignUp}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Go to sign up"
                  >
                    <Text style={styles.signUpLink}>
                      Sign Up
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.securityNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={17}
                    color={COLORS.success}
                  />

                  <Text style={styles.securityText}>
                    Secure driver access
                  </Text>
                </View>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default SignInScreen;

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
    paddingVertical: 34,
  },

  contentShell: {
    width: "100%",
  },

  contentShellTablet: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
  },

  decorOne: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    top: -110,
    right: -85,
    backgroundColor: "rgba(21,157,227,0.12)",
  },

  decorTwo: {
    position: "absolute",
    width: 165,
    height: 165,
    borderRadius: 83,
    left: -78,
    top: 160,
    backgroundColor: "rgba(56,189,248,0.07)",
  },

  heroFrame: {
    height: 286,
    marginHorizontal: 16,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: COLORS.navy900,
  },

  heroFrameCompact: {
    height: 242,
    marginHorizontal: 12,
    borderRadius: 26,
  },

  heroFrameTablet: {
    height: 360,
    marginHorizontal: 24,
  },

  heroImageContainer: {
    flex: 1,
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  heroOverlay: {
    flex: 1,
  },

  card: {
    marginTop: -26,
    marginHorizontal: 16,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    shadowColor: "#020C18",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },

  cardCompact: {
    marginHorizontal: 12,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 20,
    borderRadius: 26,
  },

  cardTablet: {
    maxWidth: 620,
    width: "72%",
    alignSelf: "center",
    marginTop: -44,
    paddingHorizontal: 34,
    paddingVertical: 32,
  },

  headingSection: {
    marginBottom: 22,
  },

  title: {
    color: COLORS.text,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  titleCompact: {
    fontSize: 26,
    lineHeight: 32,
  },

  subtitle: {
    marginTop: 8,
    color: COLORS.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },

  fieldGroup: {
    marginBottom: 16,
  },

  label: {
    marginBottom: 8,
    color: COLORS.text,
    fontSize: 13.5,
    fontWeight: "800",
  },

  inputBox: {
    minHeight: 58,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    flexDirection: "row",
    alignItems: "center",
  },

  errorBorder: {
    borderColor: "#F87171",
    backgroundColor: "#FFF8F8",
  },

  inputIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#E5F3FC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },

  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 15.5,
    fontWeight: "500",
  },

  eyeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  errorText: {
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

  signInButton: {
    height: 58,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: COLORS.blue600,
    shadowOffset: {
      width: 0,
      height: 9,
    },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },

  signInButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },

  signInGradient: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  signInText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  signUpRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  signUpPrompt: {
    color: COLORS.body,
    fontSize: 13.5,
    fontWeight: "500",
    marginRight: 6,
  },

  signUpLink: {
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
    color: COLORS.body,
    fontSize: 12,
    fontWeight: "700",
  },
});

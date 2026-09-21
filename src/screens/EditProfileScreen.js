import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
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

import AppIcon from "../components/common/AppIcon";
import colors from "../utils/colors";

const FALLBACK = {
  primary: colors?.primary || "#0B3B69",
  primaryDark: colors?.primaryDark || "#071E3B",
  accent: colors?.accent || "#159DE3",
  background: colors?.background || "#F3F6FB",
  surface: colors?.surface || "#FFFFFF",
  text: colors?.text || "#0F172A",
  textSecondary: colors?.textSecondary || "#64748B",
  textInverse: colors?.textInverse || "#FFFFFF",
  border: colors?.border || "#DDE6F0",
  success: colors?.success || "#16A34A",
  danger: colors?.danger || "#DC2626",
};

const FIELD_CONFIG = {
  name: {
    label: "Full Name",
    placeholder: "Enter your full name",
    iconLibrary: "MaterialCommunityIcons",
    iconName: "account-outline",
    keyboardType: "default",
    autoCapitalize: "words",
  },
  phone: {
    label: "Phone Number",
    placeholder: "Enter phone number",
    iconLibrary: "MaterialCommunityIcons",
    iconName: "phone-outline",
    keyboardType: "phone-pad",
    autoCapitalize: "none",
  },
  email: {
    label: "Email Address",
    placeholder: "Enter email address",
    iconLibrary: "MaterialCommunityIcons",
    iconName: "email-outline",
    keyboardType: "email-address",
    autoCapitalize: "none",
  },
  vehicle: {
    label: "Vehicle Details",
    placeholder: "Enter vehicle model and registration",
    iconLibrary: "MaterialCommunityIcons",
    iconName: "truck-outline",
    keyboardType: "default",
    autoCapitalize: "characters",
  },
};

export default function EditProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;

  const phoneRef = useRef(null);
  const emailRef = useRef(null);
  const vehicleRef = useRef(null);

  const [name, setName] = useState("Shivam Driver");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [email, setEmail] = useState("shivam.driver@example.com");
  const [vehicle, setVehicle] = useState("Tata Ace | MH12AB1234");

  const [focusedField, setFocusedField] = useState("");
  const [saving, setSaving] = useState(false);

  const initials = useMemo(() => {
    const value = String(name || "").trim();

    if (!value) return "D";

    return value
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [name]);

  const isValid = useMemo(() => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();

    return (
      cleanName.length >= 2 &&
      cleanPhone.length >= 7 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    );
  }, [email, name, phone]);

  const handleSave = async () => {
    if (!isValid || saving) {
      Alert.alert(
        "Check profile details",
        "Please enter a valid name, phone number and email address."
      );
      return;
    }

    Keyboard.dismiss();
    setSaving(true);

    try {
      // Replace this block with the existing profile update API call.
      await new Promise((resolve) => setTimeout(resolve, 500));

      Alert.alert(
        "Profile updated",
        "Your profile details have been saved successfully.",
        [
          {
            text: "Done",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Update failed",
        error?.response?.data?.message ||
          error?.message ||
          "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderField = ({
    key,
    value,
    onChangeText,
    inputRef,
    returnKeyType,
    onSubmitEditing,
    editable = true,
  }) => {
    const config = FIELD_CONFIG[key];
    const isFocused = focusedField === key;

    return (
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{config.label}</Text>

        <View
          style={[
            styles.inputShell,
            isFocused && styles.inputShellFocused,
            !editable && styles.inputShellDisabled,
          ]}
        >
          <View
            style={[
              styles.inputIconBox,
              isFocused && styles.inputIconBoxFocused,
            ]}
          >
            <AppIcon
              library={config.iconLibrary}
              name={config.iconName}
              size={21}
              color={isFocused ? FALLBACK.accent : FALLBACK.textSecondary}
            />
          </View>

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={config.placeholder}
            placeholderTextColor="#9AA8BC"
            keyboardType={config.keyboardType}
            autoCapitalize={config.autoCapitalize}
            autoCorrect={false}
            editable={editable && !saving}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={returnKeyType === "done"}
            onFocus={() => setFocusedField(key)}
            onBlur={() => setFocusedField("")}
            numberOfLines={1}
          />

          {value ? (
            <View style={styles.fieldStatus}>
              <AppIcon
                library="Ionicons"
                name="checkmark-circle"
                size={18}
                color={FALLBACK.success}
              />
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={FALLBACK.primaryDark}
        translucent={false}
      />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.scrollContentTablet,
            {
              paddingBottom: 124 + insets.bottom,
            },
          ]}
        >
          <View
            style={[
              styles.contentShell,
              isTablet && styles.contentShellTablet,
            ]}
          >
            <LinearGradient
              colors={[
                FALLBACK.primaryDark,
                FALLBACK.primary,
                FALLBACK.accent,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.header,
                isCompactPhone && styles.headerCompact,
              ]}
            >
              <View pointerEvents="none" style={styles.headerCircleLarge} />
              <View pointerEvents="none" style={styles.headerCircleSmall} />

              <View style={styles.headerTopRow}>
                <TouchableOpacity
                  style={styles.headerAction}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <AppIcon
                    library="Ionicons"
                    name="arrow-back"
                    size={22}
                    color={FALLBACK.textInverse}
                  />
                </TouchableOpacity>

                <View style={styles.headerTitleBlock}>
                  <Text style={styles.headerEyebrow}>ACCOUNT SETTINGS</Text>
                  <Text style={styles.headerTitle}>Edit Profile</Text>
                </View>

                <View style={styles.headerActionPlaceholder} />
              </View>

              <View style={styles.profileSummary}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={styles.profileSummaryText}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {name || "Driver"}
                  </Text>

                  <View style={styles.verifiedRow}>
                    <AppIcon
                      library="Ionicons"
                      name="checkmark-circle"
                      size={16}
                      color="#5EE6B3"
                    />

                    <Text style={styles.verifiedText}>
                      Verified driver profile
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.formCard}>
              <View style={styles.formHeadingRow}>
                <View style={styles.formHeadingIcon}>
                  <AppIcon
                    library="MaterialCommunityIcons"
                    name="account-edit-outline"
                    size={24}
                    color={FALLBACK.accent}
                  />
                </View>

                <View style={styles.formHeadingText}>
                  <Text style={styles.formTitle}>Profile Details</Text>
                  <Text style={styles.formSubtitle}>
                    Keep your personal and vehicle information up to date.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {renderField({
                key: "name",
                value: name,
                onChangeText: setName,
                returnKeyType: "next",
                onSubmitEditing: () => phoneRef.current?.focus(),
              })}

              {renderField({
                key: "phone",
                value: phone,
                onChangeText: setPhone,
                inputRef: phoneRef,
                returnKeyType: "next",
                onSubmitEditing: () => emailRef.current?.focus(),
              })}

              {renderField({
                key: "email",
                value: email,
                onChangeText: setEmail,
                inputRef: emailRef,
                returnKeyType: "next",
                onSubmitEditing: () => vehicleRef.current?.focus(),
              })}

              {renderField({
                key: "vehicle",
                value: vehicle,
                onChangeText: setVehicle,
                inputRef: vehicleRef,
                returnKeyType: "done",
                onSubmitEditing: handleSave,
              })}

              <View style={styles.helperCard}>
                <View style={styles.helperIcon}>
                  <AppIcon
                    library="Ionicons"
                    name="information-circle-outline"
                    size={20}
                    color={FALLBACK.accent}
                  />
                </View>

                <Text style={styles.helperText}>
                  Changes to vehicle details may require admin verification.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.fixedFooter,
            {
              paddingBottom: Math.max(14, insets.bottom + 8),
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!isValid || saving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!isValid || saving}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
          >
            <LinearGradient
              colors={
                isValid && !saving
                  ? [FALLBACK.primary, FALLBACK.accent]
                  : ["#CBD5E1", "#D8E0EB"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButtonGradient}
            >
              <AppIcon
                library="Ionicons"
                name={saving ? "time-outline" : "checkmark-circle-outline"}
                size={21}
                color={FALLBACK.textInverse}
              />

              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: FALLBACK.primaryDark,
  },

  screen: {
    flex: 1,
    backgroundColor: FALLBACK.background,
  },

  scrollContent: {
    flexGrow: 1,
    paddingTop: 12,
  },

  scrollContentTablet: {
    paddingVertical: 30,
  },

  contentShell: {
    width: "100%",
  },

  contentShellTablet: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },

  header: {
    minHeight: 230,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderRadius: 30,
    overflow: "hidden",
  },

  headerCompact: {
    minHeight: 214,
    marginHorizontal: 12,
    paddingHorizontal: 16,
  },

  headerCircleLarge: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -72,
    top: -78,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  headerCircleSmall: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    left: -42,
    bottom: -52,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },

  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  headerActionPlaceholder: {
    width: 44,
    height: 44,
    flexShrink: 0,
  },

  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
  },

  headerEyebrow: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.45,
  },

  headerTitle: {
    marginTop: 4,
    color: FALLBACK.textInverse,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  profileSummary: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },

  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.52)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  avatarText: {
    color: FALLBACK.primary,
    fontSize: 26,
    fontWeight: "900",
  },

  profileSummaryText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 15,
  },

  profileName: {
    color: FALLBACK.textInverse,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },

  verifiedRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  verifiedText: {
    marginLeft: 6,
    color: "rgba(255,255,255,0.78)",
    fontSize: 12.5,
    fontWeight: "700",
  },

  formCard: {
    marginTop: -22,
    marginHorizontal: 16,
    marginBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
    borderRadius: 28,
    backgroundColor: FALLBACK.surface,
    shadowColor: "#153A60",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 8,
  },

  formHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  formHeadingIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#E8F5FD",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  formHeadingText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 13,
  },

  formTitle: {
    color: FALLBACK.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },

  formSubtitle: {
    marginTop: 4,
    color: FALLBACK.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "500",
  },

  divider: {
    height: 1,
    marginTop: 19,
    marginBottom: 20,
    backgroundColor: "#EAF0F6",
  },

  fieldGroup: {
    marginBottom: 17,
  },

  fieldLabel: {
    marginBottom: 8,
    marginLeft: 2,
    color: FALLBACK.text,
    fontSize: 13,
    fontWeight: "800",
  },

  inputShell: {
    minHeight: 58,
    paddingHorizontal: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FALLBACK.border,
    backgroundColor: "#F8FAFD",
    flexDirection: "row",
    alignItems: "center",
  },

  inputShellFocused: {
    borderColor: FALLBACK.accent,
    backgroundColor: FALLBACK.surface,
    shadowColor: FALLBACK.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.11,
    shadowRadius: 10,
    elevation: 4,
  },

  inputShellDisabled: {
    opacity: 0.65,
  },

  inputIconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#EAF2FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },

  inputIconBoxFocused: {
    backgroundColor: "#E3F4FE",
  },

  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    color: FALLBACK.text,
    fontSize: 15,
    fontWeight: "500",
  },

  fieldStatus: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  helperCard: {
    marginTop: 2,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: "#F1F8FD",
    borderWidth: 1,
    borderColor: "#D9EDF9",
    flexDirection: "row",
    alignItems: "flex-start",
  },

  helperIcon: {
    width: 26,
    alignItems: "center",
    paddingTop: 1,
    flexShrink: 0,
  },

  helperText: {
    flex: 1,
    marginLeft: 7,
    color: FALLBACK.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  fixedFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: "rgba(243,246,251,0.96)",
    borderTopWidth: 1,
    borderTopColor: "#E5EBF2",
  },

  saveButton: {
    height: 58,
    borderRadius: 19,
    overflow: "hidden",
    shadowColor: FALLBACK.primary,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 7,
  },

  saveButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },

  saveButtonGradient: {
    flex: 1,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonText: {
    marginLeft: 9,
    color: FALLBACK.textInverse,
    fontSize: 16,
    fontWeight: "900",
  },
});

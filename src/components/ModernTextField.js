import React, { memo, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
} from "react-native";
import AppIcon from "./common/AppIcon";
import {
  COLORS,
  SPACING,
  RADIUS,
  TYPOGRAPHY,
} from "../theme/tokens";

const ModernTextField = memo(
  ({
    label,
    placeholder,
    value,
    onChangeText,
    icon,
    rightIcon,
    onRightIconPress,
    error,
    disabled,
    multiline = false,
    keyboardType = "default",
    secureTextEntry = false,
    style,
  }) => {
    const [focused, setFocused] = useState(false);

    return (
      <View style={[styles.container, style]}>
        {label && (
          <Text style={styles.label}>{label}</Text>
        )}
        <View
          style={[
            styles.inputContainer,
            focused && styles.focused,
            error && styles.error,
            disabled && styles.disabled,
          ]}
        >
          {icon && (
            <View style={styles.leftIcon}>{icon}</View>
          )}
          <TextInput
            style={[
              styles.input,
              multiline && styles.multiline,
            ]}
            placeholder={placeholder}
            placeholderTextColor={COLORS.text.muted}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={!disabled}
            multiline={multiline}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
          />
          {rightIcon && (
            <TouchableOpacity
              onPress={onRightIconPress}
              style={styles.rightIcon}
            >
              {rightIcon}
            </TouchableOpacity>
          )}
        </View>
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>
    );
  }
);

ModernTextField.displayName = "ModernTextField";

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  focused: {
    borderColor: COLORS.primary.main,
    borderWidth: 2,
  },
  error: {
    borderColor: COLORS.danger,
  },
  disabled: {
    backgroundColor: COLORS.surfaceSecondary,
    opacity: 0.6,
  },
  leftIcon: {
    marginRight: SPACING.sm,
  },
  rightIcon: {
    marginLeft: SPACING.sm,
    padding: SPACING.sm,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body1,
    color: COLORS.text.primary,
  },
  multiline: {
    minHeight: 100,
    paddingVertical: SPACING.md,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.danger,
    marginTop: SPACING.xs,
  },
});

export default ModernTextField;

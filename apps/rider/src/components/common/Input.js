import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
} from 'react-native';
import { COLORS, SIZES, FONTS } from '../../utils/constants';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  error,
  maxLength,
  editable = true,
  secureTextEntry = false,
  autoFocus = false,
  autoCapitalize = 'sentences',
  leftIcon,
  hideDefaultPrefixIcon = false,
  rightIcon,
  style,
  cursorColor,
  selectionColor,
  showCursor = true,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  let defaultPrefixIcon = null;

  if (!hideDefaultPrefixIcon) {
    if (label?.includes('First') || label?.includes('Last')) {
      defaultPrefixIcon = <Text style={styles.prefixIcon}>👤</Text>;
    } else if (label?.includes('Email')) {
      defaultPrefixIcon = <Text style={styles.prefixIcon}>✉️</Text>;
    } else if (label?.includes('Password')) {
      defaultPrefixIcon = <Text style={styles.prefixIcon}>🔒</Text>;
    }
  }

  const prefixIconNode = leftIcon || defaultPrefixIcon;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        {prefixIconNode ? <View style={styles.iconPrefix}>{prefixIconNode}</View> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={editable}
          secureTextEntry={secureTextEntry}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          cursorColor={cursorColor}
          selectionColor={selectionColor}
          caretHidden={!showCursor}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {rightIcon && (
          <View style={styles.rightIcon}>
            {rightIcon}
          </View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: FONTS.sizes.small,
    color: COLORS.text,
    marginBottom: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 12,
    height: 52,
  },
  inputFocused: {
    borderColor: COLORS.teal,
    backgroundColor: COLORS.white,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  iconPrefix: {
    marginRight: 8,
  },
  prefixIcon: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    fontSize: FONTS.sizes.regular,
    color: COLORS.text,
  },
  rightIcon: {
    marginLeft: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.small,
    marginTop: 4,
  },
});

export default Input;


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
  rightIcon,
  style,
}) => {
  const [isFocused, setIsFocused] = useState(false);

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
        <View style={styles.iconPrefix}>
          {label?.includes('First') && <Text style={styles.prefixIcon}>👤</Text>}
          {label?.includes('Last') && <Text style={styles.prefixIcon}>👤</Text>}
          {label?.includes('Email') && <Text style={styles.prefixIcon}>✉️</Text>}
          {label?.includes('Password') && <Text style={styles.prefixIcon}>🔒</Text>}
        </View>
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
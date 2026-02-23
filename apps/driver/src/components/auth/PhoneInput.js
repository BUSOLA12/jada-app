import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS, FONTS } from '../../utils/constants';

const PhoneInput = ({ value, onChangeText, error, onFocus }) => {
  const [countryCode, setCountryCode] = useState('+234');
  const { width, height } = useWindowDimensions();
  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
  const scaleBase = Math.min(width / 375, height / 812);
  const scale = (val) => Math.round(val * scaleBase);
  const containerHeight = clamp(scale(56), 48, 64);
  const containerRadius = clamp(scale(12), 10, 16);
  const containerPadding = clamp(scale(16), 12, 20);
  const flagSize = clamp(scale(24), 18, 28);
  const flagMargin = clamp(scale(4), 2, 6);
  const dividerPadding = clamp(scale(12), 8, 16);
  const dividerMargin = clamp(scale(12), 8, 16);
  const dropdownSize = clamp(scale(10), 8, 12);
  const inputSize = clamp(scale(FONTS.sizes.regular), 13, 18);
  const errorSize = clamp(scale(FONTS.sizes.small), 11, 14);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputContainer,
          {
            height: containerHeight,
            borderRadius: containerRadius,
            paddingHorizontal: containerPadding,
          },
          error && styles.inputError,
        ]}
      >
        {/* Country Flag */}
        <View
          style={[
            styles.flagContainer,
            { paddingRight: dividerPadding, marginRight: dividerMargin },
          ]}
        >
          <Text style={[styles.flag, { fontSize: flagSize, marginRight: flagMargin }]}>🇳🇬</Text>
          <Text style={[styles.dropdownIcon, { fontSize: dropdownSize }]}>▼</Text>
        </View>

        {/* Phone Number Input */}
        <TextInput
          style={[styles.input, { fontSize: inputSize }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder="+234 Mobile number"
          placeholderTextColor={COLORS.textLight}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </View>
      {error && <Text style={[styles.errorText, { fontSize: errorSize }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  flag: {},
  dropdownIcon: {
    color: COLORS.textSecondary,
  },
  input: {
    flex: 1,
    color: COLORS.text,
  },
  errorText: {
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default PhoneInput;

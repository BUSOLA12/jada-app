import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { COLORS, SIZES, FONTS } from '../../utils/constants';

const OTPInput = ({ length = 6, onComplete, onFocus }) => {
  const [otp, setOtp] = useState(Array(length).fill(''));
  const inputs = useRef([]);

  const handleChange = (text, index) => {
    if (text && !/^\d+$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (newOtp.every((digit) => digit !== '')) {
      onComplete(newOtp.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {otp.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputs.current[index] = ref)}
          style={[styles.input, digit && styles.inputFilled]}
          value={digit}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          onFocus={() => onFocus?.(index)}
          keyboardType="number-pad"
          maxLength={1}
          autoFocus={index === 0}
          selectTextOnFocus
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  input: {
    width: 45,
    height: 50,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: FONTS.sizes.xlarge,
    fontWeight: '600',
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  inputFilled: {
    borderColor: COLORS.teal,
    backgroundColor: COLORS.teal + '10',
  },
});

export default OTPInput;

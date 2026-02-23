import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SIZES, FONTS } from '../../utils/constants';

const Button = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const getButtonStyle = () => {
    if (disabled || loading) {
      return [styles.button, styles.disabled, style];
    }
    
    switch (variant) {
      case 'secondary':
        return [styles.button, styles.secondary, style];
      case 'outline':
        return [styles.button, styles.outline, style];
      default:
        return [styles.button, styles.primary, style];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
        return [styles.text, styles.outlineText, textStyle];
      default:
        return [styles.text, textStyle];
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? COLORS.teal : COLORS.white} />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: SIZES.buttonHeight,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
  },
  primary: {
    backgroundColor: COLORS.teal,
  },
  secondary: {
    backgroundColor: COLORS.orange,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  disabled: {
    backgroundColor: COLORS.gray,
    opacity: 0.5,
  },
  text: {
    color: COLORS.white,
    fontSize: FONTS.sizes.regular,
    fontWeight: '600',
  },
  outlineText: {
    color: COLORS.teal,
  },
});

export default Button;
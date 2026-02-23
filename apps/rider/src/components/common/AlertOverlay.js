import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { COLORS, FONTS, SIZES, SHADOWS } from '../../utils/constants';

const AlertOverlay = ({ visible, type = 'info', title, message, onClose, actionLabel = 'OK' }) => {
  const theme = {
    success: { accent: COLORS.success, bg: 'rgba(76, 175, 80, 0.12)' },
    error: { accent: COLORS.error, bg: 'rgba(231, 76, 60, 0.12)' },
    info: { accent: COLORS.teal, bg: 'rgba(13, 92, 76, 0.12)' },
  }[type] || { accent: COLORS.teal, bg: 'rgba(13, 92, 76, 0.12)' };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, { borderColor: theme.accent }]}>
              <View style={[styles.iconCircle, { backgroundColor: theme.bg }]}>
                <Text style={[styles.iconText, { color: theme.accent }]}>
                  {type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}
                </Text>
              </View>

              {!!title && <Text style={styles.title}>{title}</Text>}
              {!!message && <Text style={styles.message}>{message}</Text>}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: COLORS.teal }]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>{actionLabel}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    ...SHADOWS.large,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    fontSize: FONTS.sizes.large,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.regular,
    fontWeight: '700',
  },
});

export default AlertOverlay;

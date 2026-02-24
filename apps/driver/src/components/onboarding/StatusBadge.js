import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS } from '../../utils/constants';

const STATUS_THEME = {
  PENDING: { bg: `${COLORS.warning}22`, text: COLORS.warning },
  APPROVED: { bg: `${COLORS.success}22`, text: COLORS.success },
  REJECTED: { bg: `${COLORS.error}22`, text: COLORS.error },
  EXPIRED: { bg: `${COLORS.error}22`, text: COLORS.error },
  ACTIVE: { bg: `${COLORS.success}22`, text: COLORS.success },
  PENDING_REVIEW: { bg: `${COLORS.warning}22`, text: COLORS.warning },
  UNVERIFIED: { bg: `${COLORS.secondary}22`, text: COLORS.secondary },
  SUSPENDED: { bg: `${COLORS.error}22`, text: COLORS.error },
};

const StatusBadge = ({ status, label }) => {
  const normalized = String(status || '').trim().toUpperCase();
  const theme = STATUS_THEME[normalized] || {
    bg: `${COLORS.textSecondary}20`,
    text: COLORS.textSecondary,
  };

  return (
    <View style={[styles.badge, { backgroundColor: theme.bg }]}>
      <Text style={[styles.label, { color: theme.text }]}>{label || normalized || 'UNKNOWN'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FONTS.sizes.small,
    fontWeight: '700',
  },
});

export default StatusBadge;


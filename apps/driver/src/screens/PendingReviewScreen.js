import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';
import { useDriver } from '../hooks/useDriver';
import StatusBadge from '../components/onboarding/StatusBadge';

const PendingReviewScreen = ({ navigation }) => {
  const { driver, refreshDriver, refreshing, enums } = useDriver();

  const handleRefresh = async () => {
    const onboarding = await refreshDriver();
    const status = String(onboarding?.driver?.status || driver?.status || '').toUpperCase();
    if (status === enums.DRIVER_STATUSES.ACTIVE) {
      navigation.replace('Approved');
    }
    if (status === enums.DRIVER_STATUSES.REJECTED || status === enums.DRIVER_STATUSES.SUSPENDED) {
      navigation.replace('RejectedFixIssues');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Pending Review</Text>
        <Text style={styles.subtitle}>
          Your onboarding package has been submitted. Our team will review your documents and vehicle details.
        </Text>
        <StatusBadge status={driver?.status || enums.DRIVER_STATUSES.PENDING_REVIEW} />

        <TouchableOpacity style={styles.primaryButton} onPress={handleRefresh}>
          <Text style={styles.primaryButtonText}>{refreshing ? 'Checking...' : 'Refresh Status'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('OnboardingHome')}>
          <Text style={styles.secondaryButtonText}>Back to Checklist</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    ...SHADOWS.small,
  },
  title: {
    fontSize: FONTS.sizes.xlarge,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginVertical: 12,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
});

export default PendingReviewScreen;

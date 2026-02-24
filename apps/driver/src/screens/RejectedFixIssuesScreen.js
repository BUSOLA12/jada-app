import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';
import { useDriver } from '../hooks/useDriver';
import StatusBadge from '../components/onboarding/StatusBadge';

const RejectedFixIssuesScreen = ({ navigation }) => {
  const { driver, eligibility, enums } = useDriver();
  const rejectedDocs = eligibility?.missingItems?.rejectedOrExpiredDocuments || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Fix Issues</Text>
        <Text style={styles.subtitle}>
          Your onboarding has issues that must be fixed before approval.
        </Text>
        <StatusBadge status={driver?.status || enums.DRIVER_STATUSES.REJECTED} />

        {eligibility?.blockingReasons?.length > 0 && (
          <View style={styles.blockingCard}>
            <Text style={styles.blockingTitle}>Blocking reasons</Text>
            {eligibility.blockingReasons.map((reason) => (
              <Text key={reason} style={styles.blockingText}>
                - {reason}
              </Text>
            ))}
          </View>
        )}

        {rejectedDocs.length > 0 && (
          <View style={styles.blockingCard}>
            <Text style={styles.blockingTitle}>Reupload required</Text>
            {rejectedDocs.map((docType) => (
              <Text key={docType} style={styles.blockingText}>
                - {docType}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.replace('OnboardingHome')}>
          <Text style={styles.primaryButtonText}>Open Checklist</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
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
    lineHeight: 20,
    marginVertical: 12,
  },
  blockingCard: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${COLORS.error}66`,
    backgroundColor: `${COLORS.error}10`,
  },
  blockingTitle: {
    color: COLORS.text,
    fontWeight: '800',
    marginBottom: 4,
  },
  blockingText: {
    color: COLORS.text,
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
});

export default RejectedFixIssuesScreen;



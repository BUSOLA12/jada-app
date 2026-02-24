import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';
import { useDriver } from '../hooks/useDriver';
import StatusBadge from '../components/onboarding/StatusBadge';

const OnboardingHomeScreen = ({ navigation }) => {
  const { driver, eligibility, documentsByType, vehicle, agreements, enums, refreshDriver, refreshing } = useDriver();

  const completedCount = useMemo(() => {
    let count = 0;
    if (driver?.accountVerified) count += 1;
    if (eligibility?.missingItems?.documents?.length === 0) count += 1;
    if (!eligibility?.missingItems?.vehicle) count += 1;
    if (!eligibility?.missingItems?.agreements) count += 1;
    if (driver?.status === enums.DRIVER_STATUSES.PENDING_REVIEW || driver?.status === enums.DRIVER_STATUSES.ACTIVE) {
      count += 1;
    }
    return count;
  }, [driver?.accountVerified, driver?.status, eligibility, enums.DRIVER_STATUSES]);

  const progressPercent = Math.round((completedCount / 5) * 100);

  const checklist = [
    {
      id: 'account',
      title: 'Account Setup',
      complete: Boolean(driver?.accountVerified),
      action: () => navigation.navigate('ProfileSetup'),
      actionLabel: 'Complete',
    },
    {
      id: 'documents',
      title: 'Documents',
      complete: eligibility?.missingItems?.documents?.length === 0,
      action: () => navigation.navigate('DocumentUpload'),
      actionLabel: 'Upload',
    },
    {
      id: 'vehicle',
      title: 'Vehicle Details',
      complete: !eligibility?.missingItems?.vehicle,
      action: () => navigation.navigate('VehicleAdd'),
      actionLabel: 'Add vehicle',
    },
    {
      id: 'agreements',
      title: 'Agreements',
      complete: !eligibility?.missingItems?.agreements,
      action: () => navigation.navigate('Agreements'),
      actionLabel: 'Accept',
    },
    {
      id: 'review',
      title: 'Review & Submit',
      complete:
        driver?.status === enums.DRIVER_STATUSES.PENDING_REVIEW ||
        driver?.status === enums.DRIVER_STATUSES.ACTIVE,
      action: () => navigation.navigate('ReviewAndSubmit'),
      actionLabel: 'Review',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Driver Onboarding</Text>
          <Text style={styles.subtitle}>Finish your setup to submit for approval.</Text>
          <View style={styles.rowBetween}>
            <StatusBadge status={driver?.status || enums.DRIVER_STATUSES.UNVERIFIED} />
            <Text style={styles.progressText}>{progressPercent}% complete</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {checklist.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.rowBetween}>
              <View style={styles.itemTitleWrap}>
                <MaterialIcons
                  name={item.complete ? 'check-circle' : 'radio-button-unchecked'}
                  color={item.complete ? COLORS.success : COLORS.textSecondary}
                  size={20}
                />
                <Text style={styles.itemTitle}>{item.title}</Text>
              </View>
              <TouchableOpacity style={styles.itemAction} onPress={item.action}>
                <Text style={styles.itemActionText}>{item.actionLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {eligibility?.blockingReasons?.length > 0 && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Blocking reasons</Text>
            {eligibility.blockingReasons.map((reason) => (
              <Text key={reason} style={styles.warningLine}>
                • {reason}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, !eligibility?.canSubmitForReview && styles.disabledButton]}
          disabled={!eligibility?.canSubmitForReview}
          onPress={() => navigation.navigate('ReviewAndSubmit')}
        >
          <Text style={styles.primaryButtonText}>Submit For Review</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={refreshDriver} disabled={refreshing}>
          <Text style={styles.secondaryButtonText}>{refreshing ? 'Refreshing...' : 'Refresh checklist'}</Text>
        </TouchableOpacity>

        {driver?.status === enums.DRIVER_STATUSES.PENDING_REVIEW && (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('PendingReview')}>
            <Text style={styles.secondaryButtonText}>View pending review status</Text>
          </TouchableOpacity>
        )}

        {driver?.status === enums.DRIVER_STATUSES.ACTIVE && (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('Approved')}>
            <Text style={styles.secondaryButtonText}>Ready to drive</Text>
          </TouchableOpacity>
        )}

        {(driver?.status === enums.DRIVER_STATUSES.REJECTED ||
          driver?.status === enums.DRIVER_STATUSES.SUSPENDED) && (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('RejectedFixIssues')}>
            <Text style={styles.secondaryButtonText}>Fix rejected items</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.small,
  },
  title: {
    fontSize: FONTS.sizes.xlarge,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: COLORS.textSecondary,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontWeight: '700',
    color: COLORS.text,
  },
  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.lightGray,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.teal,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    ...SHADOWS.small,
  },
  itemTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    fontSize: FONTS.sizes.regular,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemAction: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: `${COLORS.teal}12`,
  },
  itemActionText: {
    color: COLORS.teal,
    fontWeight: '700',
  },
  warningCard: {
    backgroundColor: `${COLORS.warning}12`,
    borderColor: `${COLORS.warning}55`,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warningTitle: {
    fontWeight: '800',
    marginBottom: 6,
    color: COLORS.text,
  },
  warningLine: {
    color: COLORS.text,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.teal,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
});

export default OnboardingHomeScreen;

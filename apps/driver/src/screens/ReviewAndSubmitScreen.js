import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';
import { useDriver } from '../hooks/useDriver';
import Button from '../components/common/Button';
import AlertOverlay from '../components/common/AlertOverlay';
import StatusBadge from '../components/onboarding/StatusBadge';

const ReviewAndSubmitScreen = ({ navigation }) => {
  const { driver, eligibility, submitForReview, documentsByType, enums } = useDriver();
  const [submitting, setSubmitting] = useState(false);
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const uploadedCount = useMemo(() => {
    return (enums.REQUIRED_DOCUMENT_TYPES || []).filter(
      (type) => documentsByType?.[type]?.filePath || documentsByType?.[type]?.downloadUrl
    ).length;
  }, [documentsByType, enums.REQUIRED_DOCUMENT_TYPES]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await submitForReview();
      if (result.success) {
        navigation.replace('PendingReview');
        return;
      }
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Cannot submit yet',
        message:
          result?.eligibility?.blockingReasons?.join('\n') ||
          'Please complete all checklist items before submitting.',
      });
    } catch (error) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Submit failed',
        message: error?.message || 'Unable to submit onboarding for review.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Review & Submit</Text>
          <Text style={styles.subtitle}>Confirm details, then submit your onboarding package.</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Current status</Text>
            <StatusBadge status={driver?.status || enums.DRIVER_STATUSES.UNVERIFIED} />
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Required documents uploaded</Text>
            <Text style={styles.summaryValue}>
              {uploadedCount}/{(enums.REQUIRED_DOCUMENT_TYPES || []).length}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Can submit</Text>
            <Text style={styles.summaryValue}>{eligibility?.canSubmitForReview ? 'Yes' : 'No'}</Text>
          </View>

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

          <Button
            title="Submit For Review"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!eligibility?.canSubmitForReview || submitting}
          />

          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('OnboardingHome')}>
            <Text style={styles.secondaryButtonText}>Back to Checklist</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AlertOverlay
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState((prev) => ({ ...prev, visible: false }))}
      />
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
    marginBottom: 14,
    color: COLORS.textSecondary,
  },
  summaryRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontWeight: '700',
    color: COLORS.text,
  },
  blockingCard: {
    marginVertical: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${COLORS.warning}66`,
    backgroundColor: `${COLORS.warning}12`,
  },
  blockingTitle: {
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  blockingText: {
    color: COLORS.text,
    lineHeight: 20,
  },
  secondaryButton: {
    marginTop: 12,
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

export default ReviewAndSubmitScreen;



import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';
import { useDriver } from '../hooks/useDriver';
import StatusBadge from '../components/onboarding/StatusBadge';
import AlertOverlay from '../components/common/AlertOverlay';

const ApprovedScreen = ({ navigation }) => {
  const { driver, eligibility, isOnline, setAvailabilityOnline } = useDriver();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const handleToggleOnline = async () => {
    const nextOnline = !isOnline;
    setUpdatingStatus(true);
    try {
      const result = await setAvailabilityOnline(nextOnline);
      if (result.success) {
        setAlertState({
          visible: true,
          type: 'success',
          title: nextOnline ? 'You are online' : 'You are offline',
          message: nextOnline
            ? 'You can now receive trip requests.'
            : 'Trip requests are paused.',
        });
        return;
      }

      setAlertState({
        visible: true,
        type: 'error',
        title: 'Go online blocked',
        message:
          result?.eligibility?.blockingReasons?.join('\n') ||
          'Complete onboarding requirements before going online.',
      });
    } catch (error) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Status update failed',
        message: error?.message || 'Unable to update availability.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Approved</Text>
        <Text style={styles.subtitle}>Your account is approved. You can now go online and accept trips.</Text>
        <StatusBadge status={driver?.status || 'ACTIVE'} />

        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{isOnline ? 'Current status: ONLINE' : 'Current status: OFFLINE'}</Text>
        </View>

        {!eligibility?.canGoOnline && eligibility?.blockingReasons?.length > 0 && (
          <View style={styles.blockingCard}>
            <Text style={styles.blockingTitle}>Go online blocked</Text>
            {eligibility.blockingReasons.map((reason) => (
              <Text key={reason} style={styles.blockingText}>
                - {reason}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, updatingStatus && styles.disabledButton]}
          onPress={handleToggleOnline}
          disabled={updatingStatus}
        >
          <Text style={styles.primaryButtonText}>
            {updatingStatus ? 'Updating...' : isOnline ? 'Go Offline' : 'Go Online'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('Home')}>
          <Text style={styles.secondaryButtonText}>Go to Home</Text>
        </TouchableOpacity>
      </View>

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
  statusPill: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statusPillText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  blockingCard: {
    marginTop: 12,
    marginBottom: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${COLORS.warning}66`,
    backgroundColor: `${COLORS.warning}12`,
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
    marginTop: 14,
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
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.65,
  },
});

export default ApprovedScreen;



import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';
import { useDriver } from '../hooks/useDriver';
import Button from '../components/common/Button';
import AlertOverlay from '../components/common/AlertOverlay';

const AgreementsScreen = ({ navigation }) => {
  const { agreements, updateAgreements } = useDriver();
  const [termsAccepted, setTermsAccepted] = useState(Boolean(agreements?.termsAcceptedAt));
  const [safetyAccepted, setSafetyAccepted] = useState(Boolean(agreements?.safetyAcceptedAt));
  const [commissionAccepted, setCommissionAccepted] = useState(Boolean(agreements?.commissionAcceptedAt));
  const [saving, setSaving] = useState(false);
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const allAccepted = termsAccepted && safetyAccepted && commissionAccepted;

  const toggle = (setter, current) => () => setter(!current);

  const handleSave = async () => {
    if (!allAccepted) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Agreements required',
        message: 'Please accept all agreements before continuing.',
      });
      return;
    }

    setSaving(true);
    try {
      await updateAgreements({
        termsAccepted,
        safetyAccepted,
        commissionAccepted,
      });
      setAlertState({
        visible: true,
        type: 'success',
        title: 'Saved',
        message: 'Agreements recorded successfully.',
      });
    } catch (error) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Save failed',
        message: error?.message || 'Unable to save agreements.',
      });
    } finally {
      setSaving(false);
    }
  };

  const Item = ({ label, value, onPress }) => (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <MaterialIcons
        name={value ? 'check-box' : 'check-box-outline-blank'}
        color={value ? COLORS.teal : COLORS.textSecondary}
        size={22}
      />
      <Text style={styles.itemText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Driver Agreements</Text>
          <Text style={styles.subtitle}>Accept each agreement to complete onboarding.</Text>

          <Item label="I accept the driver terms." value={termsAccepted} onPress={toggle(setTermsAccepted, termsAccepted)} />
          <Item label="I accept the safety policy." value={safetyAccepted} onPress={toggle(setSafetyAccepted, safetyAccepted)} />
          <Item
            label="I accept commission and payout terms."
            value={commissionAccepted}
            onPress={toggle(setCommissionAccepted, commissionAccepted)}
          />

          <Button title="Save Agreements" onPress={handleSave} loading={saving} disabled={!allAccepted || saving} />

          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('ReviewAndSubmit')}>
            <Text style={styles.secondaryButtonText}>Continue to Review</Text>
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  itemText: {
    flex: 1,
    color: COLORS.text,
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

export default AgreementsScreen;


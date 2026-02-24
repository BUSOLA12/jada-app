import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useDriver } from '../hooks/useDriver';
import { COLORS, FONTS, SHADOWS } from '../utils/constants';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import AlertOverlay from '../components/common/AlertOverlay';

const ProfileSetupScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { driver, updateProfile } = useDriver();
  const [fullName, setFullName] = useState(driver?.fullName || '');
  const [dob, setDob] = useState(driver?.dob || '');
  const [phone, setPhone] = useState(driver?.phone || user?.phoneNumber || '');
  const [email, setEmail] = useState(driver?.email || user?.email || '');
  const [saving, setSaving] = useState(false);
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const canSave = useMemo(() => {
    return Boolean(fullName.trim() && dob.trim() && phone.trim());
  }, [dob, fullName, phone]);

  const handleSave = async () => {
    if (!canSave) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Missing details',
        message: 'Full name, date of birth, and phone are required.',
      });
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        dob: dob.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
      });
      setAlertState({
        visible: true,
        type: 'success',
        title: 'Saved',
        message: 'Profile setup saved successfully.',
      });
    } catch (error) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Save failed',
        message: error?.message || 'Unable to save profile details.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Profile Setup</Text>
          <Text style={styles.subtitle}>Provide your account details for onboarding.</Text>

          <Input label="Full Name" value={fullName} onChangeText={setFullName} />
          <Input
            label="Date of Birth"
            value={dob}
            onChangeText={setDob}
            placeholder="YYYY-MM-DD"
          />
          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Input
            label="Email (Optional)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <Button title="Save Profile" onPress={handleSave} loading={saving} disabled={!canSave || saving} />

          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('DocumentUpload')}>
            <Text style={styles.secondaryButtonText}>Continue to Documents</Text>
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
    marginBottom: 16,
    color: COLORS.textSecondary,
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
    fontWeight: '700',
    color: COLORS.text,
  },
});

export default ProfileSetupScreen;


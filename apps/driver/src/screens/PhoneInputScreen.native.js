import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from '@react-native-firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Button from '../components/common/Button';
import AlertOverlay from '../components/common/AlertOverlay';
import { COLORS, SIZES, FONTS, SHADOWS } from '../utils/constants';
import { validatePhoneNumber, formatPhoneNumber, normalizePhoneNumber } from '../utils/validators';
import authService from '../services/authService';
import PhoneInput from '../components/auth/PhoneInput';
import { db } from '../../firebase.config';

const PhoneInputScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef(null);
  const inputCardY = useRef(0);
  const insets = useSafeAreaInsets();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const availableHeight = Math.max(560, height - insets.top - insets.bottom);
  const scaleBase = Math.min(width / 375, availableHeight / 812);
  const scale = (value) => Math.round(value * scaleBase);
  const contentMinHeight = Math.max(420, availableHeight - 24);
  const horizontalPadding = clamp(scale(SIZES.padding), 16, 28);
  const illustrationMargin = clamp(scale(40), 24, 52);
  const illustrationCardMargin = clamp(scale(16), 10, 22);
  const greetingSize = clamp(scale(FONTS.sizes.large), 16, 22);
  const cardPadding = clamp(scale(SIZES.padding), 16, 28);
  const cardRadius = clamp(scale(SIZES.radiusLarge), 16, 26);
  const labelSize = clamp(scale(FONTS.sizes.medium), 13, 18);
  const labelMargin = clamp(scale(12), 8, 16);
  const validationSize = clamp(scale(FONTS.sizes.small), 11, 15);
  const buttonRadius = clamp(scale(12), 10, 16);
  const buttonMarginTop = clamp(scale(16), 12, 22);
  const termsSize = clamp(scale(FONTS.sizes.small), 11, 14);
  const termsMarginTop = clamp(scale(16), 12, 22);
  const termsLineHeight = clamp(scale(18), 16, 22);
  const formatHintSize = clamp(scale(FONTS.sizes.small), 10, 13);
  const formatHintMargin = clamp(scale(8), 6, 12);
  const imageWidth = clamp(Math.round(Math.min(width * 0.78, availableHeight * 0.44)), 200, 360);
  const imageHeight = Math.round(imageWidth * 1.15);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });
  const phoneIllustration = require('../../assets/phone-illustration.png');
  const cleanedPhone = phone.replace(/\D/g, '');
  const normalizedPhone = normalizePhoneNumber(phone);
  const isValidPhone = validatePhoneNumber(phone);
  const hasPlusPrefix = phone.trim().startsWith('+');
  const isNigeriaPrefix = cleanedPhone.startsWith('234');
  const isPossibleLength = cleanedPhone.length <= 13 || cleanedPhone.length === 0;

  let validationText = '';
  let validationTone = 'neutral';

  if (cleanedPhone.length > 0) {
    if (!hasPlusPrefix) {
      validationText = 'Start with +234 (country code)';
      validationTone = 'error';
    } else if (!isNigeriaPrefix) {
      validationText = 'Use the +234 format (country code)';
      validationTone = 'error';
    } else if (isValidPhone) {
      validationText = `Valid number: ${formatPhoneNumber(normalizedPhone)}`;
      validationTone = 'success';
    } else if (!isPossibleLength) {
      validationText = 'Number is too long for Nigeria';
      validationTone = 'error';
    } else {
      validationText = 'Keep typing...';
      validationTone = 'neutral';
    }
  }

  const handleContinue = async () => {
    if (!normalizedPhone) {
      setError('Please enter a valid +234 phone number');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await authService.sendOTP(normalizedPhone);

      if (result.success) {
        navigation.navigate('OTPVerification', {
          phone: normalizedPhone,
        });
      } else {
        setAlertState({
          visible: true,
          type: 'error',
          title: 'OTP failed',
          message: result.error,
        });
      }
    } catch (err) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'OTP failed',
        message: 'Failed to send OTP. Please try again.',
      });
      console.error('Phone input error:', err);
    } finally {
      setLoading(false);
    }
  };

  const bootstrapUserAfterGoogleAuth = async (firebaseUser) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);
    const userExists =
      typeof userDoc?.exists === 'function' ? userDoc.exists() : Boolean(userDoc?.exists);

    if (!userExists) {
      await setDoc(
        userRef,
        {
          phoneNumber: firebaseUser.phoneNumber || '',
          email: firebaseUser.email || '',
          firstName: firebaseUser.displayName?.split(' ')?.[0] || '',
          lastName: firebaseUser.displayName?.split(' ')?.slice(1).join(' ') || '',
          avatarUrl: firebaseUser.photoURL || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userType: 'rider',
          isNewUser: true,
        },
        { merge: true }
      );
    } else {
      await setDoc(
        userRef,
        {
          email: firebaseUser.email || '',
          avatarUrl: firebaseUser.photoURL || '',
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    const permissionsStatus = await AsyncStorage.getItem('permissionsGranted');
    const permissionsCompleted = permissionsStatus === 'true';
    navigation.replace(permissionsCompleted ? 'Home' : 'Permissions');
  };

  const handleContinueWithGoogle = async () => {
    setGoogleLoading(true);

    try {
      const result = await authService.signInWithGoogle();

      if (result.success) {
        await bootstrapUserAfterGoogleAuth(result.user);
        return;
      }

      if (result.cancelled) {
        return;
      }

      setAlertState({
        visible: true,
        type: 'error',
        title: 'Google sign-in failed',
        message: result.error || 'Unable to sign in with Google.',
      });
    } catch (err) {
      console.error('Google sign-in error:', err);
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Google sign-in failed',
        message: 'Unable to sign in with Google. Please try again.',
      });
    } finally {
      setGoogleLoading(false);
    }
  };
  const scrollToInputCard = () => {
    const targetY = Math.max(0, inputCardY.current - 16);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, { minHeight: contentMinHeight }]}>
            {/* Illustration */}
            <View style={[styles.illustrationContainer, { marginBottom: illustrationMargin }]}>
              <View
                style={[
                  styles.illustrationCard,
                  { width: imageWidth, height: imageHeight, marginBottom: illustrationCardMargin },
                ]}
              >
                <Image source={phoneIllustration} style={styles.illustrationImage} />
              </View>
              <Text style={[styles.greeting, { fontSize: greetingSize }]}>Hi! Nice to meet you!</Text>
            </View>

            {/* Phone Input Card */}
            <View
              style={[styles.inputCard, { padding: cardPadding, borderRadius: cardRadius }]}
              onLayout={(event) => {
                inputCardY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={[styles.label, { fontSize: labelSize, marginBottom: labelMargin }]}>
                Enter your mobile number
              </Text>
              <PhoneInput
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setError('');
                }}
                error={error}
                onFocus={scrollToInputCard}
              />
              {!!validationText && (
                <Text
                  style={[
                    styles.validationText,
                    { fontSize: validationSize },
                    validationTone === 'success' && styles.validationSuccess,
                    validationTone === 'error' && styles.validationError,
                  ]}
                >
                  {validationText}
                </Text>
              )}

              <Button
                title="Continue"
                onPress={handleContinue}
                loading={loading}
                disabled={!phone || loading || googleLoading}
                style={[
                  styles.continueButton,
                  { borderRadius: buttonRadius, marginTop: buttonMarginTop },
                ]}
              />

              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleContinueWithGoogle}
                disabled={loading || googleLoading}
                activeOpacity={0.85}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={COLORS.teal} />
                ) : (
                  <>
                    <View style={styles.googleIconBadge}>
                      <MaterialCommunityIcons name="google" size={16} color="#DB4437" />
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text
                style={[
                  styles.termsText,
                  { fontSize: termsSize, marginTop: termsMarginTop, lineHeight: termsLineHeight },
                ]}
              >
                By continuing, you agree to our{' '}
                <Text style={styles.termsLink}>Terms and Conditions</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
              <Text
                style={[styles.formatHint, { fontSize: formatHintSize, marginTop: formatHintMargin }]}
              >
                Nigeria format: +234 801 234 5678
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  illustrationCard: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  greeting: {
    fontSize: FONTS.sizes.large,
    fontWeight: '600',
    color: COLORS.teal,
  },
  inputCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    padding: SIZES.padding,
    ...SHADOWS.medium,
  },
  label: {
    fontSize: FONTS.sizes.medium,
    color: COLORS.text,
    marginBottom: 12,
    fontWeight: '500',
  },
  validationText: {
    marginTop: 6,
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
  },
  validationSuccess: {
    color: COLORS.success,
  },
  validationError: {
    color: COLORS.error,
  },
  continueButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    marginTop: 16,
  },
  googleButton: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  googleButtonText: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '600',
    color: COLORS.text,
  },
  termsText: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  termsLink: {
    color: COLORS.teal,
    fontWeight: '600',
  },
  formatHint: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default PhoneInputScreen;






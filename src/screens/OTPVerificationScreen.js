import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import OTPInput from '../components/auth/OTPInput';
import Button from '../components/common/Button';
import AlertOverlay from '../components/common/AlertOverlay';
import { COLORS, SIZES, FONTS, SHADOWS } from '../utils/constants';
import authService from '../services/authService';
import { formatPhoneNumber, normalizePhoneNumber } from '../utils/validators';
import { db } from '../../firebase.config';
import { doc, getDoc, setDoc } from '@react-native-firebase/firestore';

const OTPVerificationScreen = ({ navigation, route }) => {
  const { phone } = route.params;
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  const otpCardY = useRef(0);
  const normalizedPhone = normalizePhoneNumber(phone) || phone;
  const phoneDisplay = formatPhoneNumber(normalizedPhone);
  const insets = useSafeAreaInsets();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const imageWidth = clamp(Math.round(width * 0.75), 220, 340);
  const imageHeight = Math.round(imageWidth * 1.15);
  const otpIllustration = require('../../assets/otp-illustration.png');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }

    return () => clearInterval(interval);
  }, [timer]);

  const handleVerifyOTP = async (otpCode) => {
    setLoading(true);

    try {
      const result = await authService.verifyOTP(otpCode);

      if (result.success) {
        const user = result.user;

        // Check if user profile exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists) {
          // First time user - create basic profile
          await setDoc(userRef, {
            phoneNumber: user.phoneNumber,
            createdAt: new Date().toISOString(),
            userType: 'rider',
            isNewUser: true,
          });

          // Navigate to Permissions (first time)
          navigation.replace('Permissions');
        } else {
          // Existing user - go straight to Home
          navigation.replace('Home');
        }
      } else {
        setAlertState({
          visible: true,
          type: 'error',
          title: 'Verification failed',
          message: result.error,
        });
        setOtp('');
      }
    } catch (err) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Verification failed',
        message: 'Failed to verify OTP. Please try again.',
      });
      console.error('OTP verification error:', err);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    setCanResend(false);
    setTimer(60);

    try {
      const result = await authService.sendOTP(normalizedPhone);

      if (result.success) {
        setAlertState({
          visible: true,
          type: 'success',
          title: 'OTP sent',
          message: 'A new verification code has been sent to your phone.',
        });
      } else {
        setAlertState({
          visible: true,
          type: 'error',
          title: 'Resend failed',
          message: result.error,
        });
        setCanResend(true);
      }
    } catch (err) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Resend failed',
        message: 'Failed to resend OTP. Please try again.',
      });
      console.error('Resend OTP error:', err);
      setCanResend(true);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Illustration */}
            <View style={styles.illustrationContainer}>
              <View style={[styles.illustrationCard, { width: imageWidth, height: imageHeight }]}>
                <Image source={otpIllustration} style={styles.illustrationImage} />
              </View>
            </View>

            {/* OTP Card */}
            <View
              style={styles.otpCard}
              onLayout={(event) => {
                otpCardY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.title}>Verification Code</Text>
              <Text style={styles.subtitle}>
                Please enter the verification code{'\n'}
                Sent to your mobile number.
              </Text>

          <Text style={styles.phoneNumber}>{phoneDisplay}</Text>

              <OTPInput
                length={6}
                onComplete={(code) => {
                  setOtp(code);
                  handleVerifyOTP(code);
                }}
                onFocus={() => {
                  const targetY = Math.max(0, otpCardY.current - 16);
                  scrollRef.current?.scrollTo({ y: targetY, animated: true });
                }}
              />

          <View style={styles.resendContainer}>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOTP} disabled={resendLoading}>
                            <Text style={styles.resendHint}>Didn't receive a code?</Text>

                <Text style={styles.resendText}>
                  Click <Text style={styles.resendLabel}>Resend</Text> to get a new code
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendText}>
                <Text style={styles.resendLabel}>Resend</Text> code after {timer} seconds
              </Text>
            )}
          </View>

              <Button
                title="Submit"
                onPress={() => handleVerifyOTP(otp)}
                loading={loading}
                disabled={otp.length !== 6 || loading}
                style={styles.submitButton}
              />
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

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Verifying...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  keyboardView: {
    flex: 1,
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
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  otpCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    padding: SIZES.padding,
    ...SHADOWS.medium,
  },
  title: {
    fontSize: FONTS.sizes.xlarge,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  phoneNumber: {
    fontSize: FONTS.sizes.medium,
    color: COLORS.teal,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  resendHint: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  resendText: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
  },
  resendLabel: {
    color: COLORS.teal,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: SIZES.radius,
  },
  loadingText: {
    fontSize: FONTS.sizes.regular,
    color: COLORS.text,
    fontWeight: '600',
  },
});

export default OTPVerificationScreen;

import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import {
  GoogleSignin,
  statusCodes as googleStatusCodes,
} from '@react-native-google-signin/google-signin';
import { auth } from '../../firebase.config';

class AuthService {
  constructor() {
    this.verificationId = null;
    this.confirmation = null;
    this.googleConfigured = false;
  }

  configureGoogle() {
    if (this.googleConfigured) {
      return { success: true };
    }

    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

    if (!webClientId) {
      return {
        success: false,
        error:
          'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Add it to EAS env and rebuild your dev client.',
      };
    }

    GoogleSignin.configure({
      webClientId,
      scopes: ['email', 'profile'],
      offlineAccess: false,
      forceCodeForRefreshToken: false,
    });

    this.googleConfigured = true;
    return { success: true };
  }

  async signInWithGoogle() {
    try {
      const configured = this.configureGoogle();
      if (!configured.success) {
        return configured;
      }

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const signInResult = await GoogleSignin.signIn();
      if (!signInResult || signInResult.type === 'cancelled') {
        return {
          success: false,
          cancelled: true,
          error: 'Google sign-in cancelled.',
        };
      }

      const idToken = signInResult.data?.idToken;
      if (!idToken) {
        return {
          success: false,
          error: 'Google sign-in did not return an ID token.',
        };
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);

      return {
        success: true,
        user: userCredential.user,
      };
    } catch (error) {
      if (
        error?.code === googleStatusCodes.SIGN_IN_CANCELLED ||
        error?.code === 'SIGN_IN_CANCELLED'
      ) {
        return {
          success: false,
          cancelled: true,
          error: 'Google sign-in cancelled.',
        };
      }

      if (
        error?.code === googleStatusCodes.IN_PROGRESS ||
        error?.code === 'IN_PROGRESS'
      ) {
        return {
          success: false,
          error: 'Google sign-in is already in progress.',
        };
      }

      if (
        error?.code === googleStatusCodes.PLAY_SERVICES_NOT_AVAILABLE ||
        error?.code === 'PLAY_SERVICES_NOT_AVAILABLE'
      ) {
        return {
          success: false,
          error: 'Google Play Services is unavailable or outdated on this device.',
        };
      }

      console.error('Google sign-in error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  // Send OTP to phone number (native does not require reCAPTCHA)
  async sendOTP(phoneNumber) {
    try {
      const cleaned = phoneNumber.replace(/\D/g, '');
      const formattedPhone = phoneNumber.trim().startsWith('+')
        ? `+${cleaned}`
        : cleaned.startsWith('234')
        ? `+${cleaned}`
        : `+234${cleaned}`;

      console.log('Sending OTP to:', formattedPhone);

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone);

      this.verificationId = confirmation.verificationId;
      this.confirmation = confirmation;

      return {
        success: true,
        verificationId: confirmation.verificationId,
      };
    } catch (error) {
      console.error('Error sending OTP:', error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  // Verify OTP
  async verifyOTP(otp, confirmation) {
    try {
      const activeConfirmation = confirmation || this.confirmation;
      if (!activeConfirmation) {
        return {
          success: false,
          error: 'No confirmation session found. Please request a new code.',
        };
      }

      const result = await activeConfirmation.confirm(otp);
      this.confirmation = null;

      return {
        success: true,
        user: result.user,
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  // Sign out
  async signOut() {
    try {
      await firebaseSignOut(auth);

      try {
        await GoogleSignin.signOut();
      } catch (googleError) {
        // Ignore Google sign-out errors when no Google session exists.
      }

      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  }

  getConfirmation() {
    return this.confirmation;
  }

  clearConfirmation() {
    this.confirmation = null;
  }

  // Helper to get user-friendly error messages
  getErrorMessage(error) {
    const rawMessage = String(error?.message || '');

    if (error?.code === 'auth/unknown' && rawMessage.includes('Error code:39')) {
      return 'Phone Auth app verification failed (Play Integrity/reCAPTCHA). Confirm SHA-1 and SHA-256 for com.jada.app in Firebase, download a fresh google-services.json, rebuild, and reinstall the app.';
    }

    switch (error.code) {
      case 'auth/invalid-phone-number':
        return 'Invalid phone number format';
      case 'auth/invalid-verification-code':
        return 'Invalid verification code';
      case 'auth/code-expired':
        return 'Verification code has expired';
      case 'auth/too-many-requests':
        return 'Too many OTP attempts from this device. Wait 30-60 minutes before retrying. If it persists, wait longer, change network, or use a Firebase test phone number.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection';
      case 'auth/missing-client-identifier':
        return 'This Android build is not verified for Phone Auth yet. Add the build signing SHA-1 and SHA-256 in Firebase for package com.jada.app, download a new google-services.json, then rebuild the app.';
      case 'auth/invalid-app-credential':
        return 'Invalid app credential for Phone Auth. Confirm Firebase Android app package/SHA fingerprints and rebuild this app.';
      case 'auth/account-exists-with-different-credential':
        return 'This email already exists with another sign-in method.';
      case 'auth/operation-not-allowed':
        return 'This sign-in provider is disabled in Firebase Authentication. Enable Google provider in Firebase Console.';
      case 'auth/invalid-credential':
        return 'Google credential is invalid or expired. Please try again.';
      default:
        return error.message || 'An error occurred. Please try again';
    }
  }
}

export default new AuthService();

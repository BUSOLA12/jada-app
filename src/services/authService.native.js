import { signInWithPhoneNumber, signOut as firebaseSignOut } from "@react-native-firebase/auth";
import { auth } from "../../firebase.config";

class AuthService {
  constructor() {
    this.verificationId = null;
    this.confirmation = null;
  }

  // Send OTP to phone number (native does not require reCAPTCHA)
  async sendOTP(phoneNumber) {
    try {
      const cleaned = phoneNumber.replace(/\D/g, "");
      const formattedPhone = phoneNumber.trim().startsWith("+")
        ? `+${cleaned}`
        : cleaned.startsWith("234")
        ? `+${cleaned}`
        : `+234${cleaned}`;

      console.log("Sending OTP to:", formattedPhone);

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone);

      this.verificationId = confirmation.verificationId;
      this.confirmation = confirmation;

      return {
        success: true,
        verificationId: confirmation.verificationId,
      };
    } catch (error) {
      console.error("Error sending OTP:", error);
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
          error: "No confirmation session found. Please request a new code.",
        };
      }

      const result = await activeConfirmation.confirm(otp);
      this.confirmation = null;

      return {
        success: true,
        user: result.user,
      };
    } catch (error) {
      console.error("Error verifying OTP:", error);
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
      return { success: true };
    } catch (error) {
      console.error("Error signing out:", error);
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
    switch (error.code) {
      case "auth/invalid-phone-number":
        return "Invalid phone number format";
      case "auth/invalid-verification-code":
        return "Invalid verification code";
      case "auth/code-expired":
        return "Verification code has expired";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later";
      case "auth/network-request-failed":
        return "Network error. Please check your connection";
      default:
        return error.message || "An error occurred. Please try again";
    }
  }
}

export default new AuthService();

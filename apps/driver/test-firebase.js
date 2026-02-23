import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { signInWithPhoneNumber } from "@react-native-firebase/auth";
import { collection, getDocs } from "@react-native-firebase/firestore";
import { auth, db } from "./firebase.config";

export const testFirebaseConnection = async () => {
  try {
    console.log("Testing Firebase connection...");

    // Test Auth
    console.log("Auth initialized:", auth ? "OK" : "FAIL");

    // Test Firestore
    console.log("Firestore initialized:", db ? "OK" : "FAIL");

    // Try to read from Firestore
    const testRef = collection(db, "test");
    await getDocs(testRef);
    const phone = auth.currentUser ? auth.currentUser.phoneNumber : "No user signed in";
    console.log("Current user phone number:", phone);
    console.log("Firestore connection: OK");

    return { success: true };
  } catch (error) {
    console.error("Firebase connection error:", error);
    return { success: false, error };
  }
};

export function PhoneAuthTest() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [message, setMessage] = useState("");

  const sendCode = async () => {
    try {
      setMessage("Sending code...");
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber);
      setConfirmation(confirmationResult);
      setMessage("Code sent. Check your SMS.");
    } catch (error) {
      setMessage(`Send failed: ${error?.message || error}`);
    }
  };

  const confirmCode = async () => {
    try {
      setMessage("Verifying code...");
      if (!confirmation) {
        setMessage("Send the code first.");
        return;
      }
      await confirmation.confirm(verificationCode);
      setMessage("Phone auth success.");
    } catch (error) {
      setMessage(`Verify failed: ${error?.message || error}`);
    }
  };

  return (
    <View style={{ gap: 12, padding: 16 }}>
      <Text style={{ fontWeight: "600", fontSize: 18 }}>Phone Auth Test</Text>

      <TextInput
        placeholder="+1 555 123 4567"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        autoComplete="tel"
        keyboardType="phone-pad"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 10,
          borderRadius: 8,
        }}
      />
      <Button title="Send Code" onPress={sendCode} />

      <TextInput
        placeholder="123456"
        value={verificationCode}
        onChangeText={setVerificationCode}
        keyboardType="number-pad"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 10,
          borderRadius: 8,
        }}
      />
      <Button title="Confirm Code" onPress={confirmCode} />

      {!!message && <Text>{message}</Text>}
    </View>
  );
}

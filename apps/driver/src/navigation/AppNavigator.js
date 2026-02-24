import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';

// Screens
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import PhoneInputScreen from '../screens/PhoneInputScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import HomeScreen from '../screens/HomeScreen';
import OnboardingHomeScreen from '../screens/OnboardingHomeScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import DocumentUploadScreen from '../screens/DocumentUploadScreen';
import VehicleAddScreen from '../screens/VehicleAddScreen';
import CategorySelectScreen from '../screens/CategorySelectScreen';
import AgreementsScreen from '../screens/AgreementsScreen';
import ReviewAndSubmitScreen from '../screens/ReviewAndSubmitScreen';
import PendingReviewScreen from '../screens/PendingReviewScreen';
import ApprovedScreen from '../screens/ApprovedScreen';
import RejectedFixIssuesScreen from '../screens/RejectedFixIssuesScreen';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
        <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
        <Stack.Screen name="Permissions" component={PermissionsScreen} />
        <Stack.Screen name="OnboardingHome" component={OnboardingHomeScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
        <Stack.Screen name="VehicleAdd" component={VehicleAddScreen} />
        <Stack.Screen name="CategorySelect" component={CategorySelectScreen} />
        <Stack.Screen name="Agreements" component={AgreementsScreen} />
        <Stack.Screen name="ReviewAndSubmit" component={ReviewAndSubmitScreen} />
        <Stack.Screen name="PendingReview" component={PendingReviewScreen} />
        <Stack.Screen name="Approved" component={ApprovedScreen} />
        <Stack.Screen name="RejectedFixIssues" component={RejectedFixIssuesScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

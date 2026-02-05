import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/common/Button';
import { COLORS, SIZES, FONTS, SHADOWS } from '../utils/constants';
import permissionsService from '../services/permissionsService';
import { useAuth } from '../hooks/useAuth';

const PermissionsScreen = ({ navigation }) => {
  const { markPermissionsGranted } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleAllowLocation = async () => {
    setLoading(true);
    const result = await permissionsService.requestLocationPermission();
    setLoading(false);

    if (result.success) {
      // Also request notification permission silently
      await permissionsService.requestNotificationPermission();
      
      // Mark permissions as granted
      await markPermissionsGranted();
      
      // Navigate to Home
      navigation.replace('Home');
    } else {
      Alert.alert(
        'Permission Required',
        'Location permission is required to use this app. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleDeny = async () => {
    Alert.alert(
      'Permission Required',
      'Location access is required to find rides near you. You can enable this later in Settings.',
      [
        { 
          text: 'Continue Anyway', 
          onPress: async () => {
            await markPermissionsGranted();
            navigation.replace('Home');
          }
        },
        { text: 'Go Back', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <View style={styles.mapBackground}>
            <View style={styles.locationPulse}>
              <View style={styles.locationPulseInner} />
              <View style={styles.locationPulseOuter} />
            </View>
          </View>
        </View>

        {/* Permission Card */}
        <View style={styles.permissionCard}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📍</Text>
          </View>

          <Text style={styles.title}>
            Allow JADA to access this device's location?
          </Text>

          <Button
            title="ALLOW ONLY WHILE USING THE APP"
            onPress={handleAllowLocation}
            loading={loading}
            style={styles.allowButton}
            textStyle={styles.allowButtonText}
          />

          <Button
            title="DENY"
            onPress={handleDeny}
            variant="outline"
            style={styles.denyButton}
            textStyle={styles.denyButtonText}
          />
        </View>
      </View>
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
    justifyContent: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  mapBackground: {
    width: 300,
    height: 200,
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  locationPulse: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  locationPulseInner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.teal,
    top: 20,
    left: 20,
    opacity: 0.8,
  },
  locationPulseOuter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.teal,
    opacity: 0.2,
  },
  permissionCard: {
    backgroundColor: COLORS.teal,
    borderRadius: SIZES.radiusLarge,
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.large,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: FONTS.sizes.large,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 26,
  },
  allowButton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
  },
  allowButtonText: {
    color: COLORS.teal,
    fontSize: FONTS.sizes.small,
    fontWeight: '700',
  },
  denyButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    width: '100%',
  },
  denyButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.medium,
    fontWeight: '600',
  },
});

export default PermissionsScreen;

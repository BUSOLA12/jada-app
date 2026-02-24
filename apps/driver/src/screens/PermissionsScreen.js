import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Linking,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/common/Button';
import { COLORS, SIZES, FONTS, SHADOWS } from '../utils/constants';
import permissionsService from '../services/permissionsService';
import { useAuth } from '../hooks/useAuth';
import { useDriver } from '../hooks/useDriver';
import { resolveDriverPostPermissionRoute } from '../utils/driverRouting';
import { logBreadcrumb, recordError } from '../monitoring/crashlytics';

const PermissionsScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [contentHeight, setContentHeight] = useState(0);
  const availableHeight = height - insets.top - insets.bottom;
  const viewportHeight = Math.max(560, contentHeight || availableHeight);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const scaleBase = Math.min(width / 375, viewportHeight / 812);
  const scale = (value) => Math.round(value * scaleBase);
  const isShortScreen = viewportHeight < 740;
  const isVeryShortScreen = viewportHeight < 680;
  const horizontalPadding = clamp(scale(SIZES.padding), 14, 24);
  const verticalPadding = clamp(scale(isVeryShortScreen ? 8 : 14), 8, 20);
  const imageWidth = clamp(Math.round(width * (isVeryShortScreen ? 0.75 : isShortScreen ? 0.86 : 0.96)), 240, 460);
  const imageHeight = clamp(Math.round(viewportHeight * (isVeryShortScreen ? 0.26 : isShortScreen ? 0.36 : 0.46)), 170, 380);
  const cardPadding = clamp(scale(isVeryShortScreen ? 12 : 16), 10, 18);
  const cardSpacing = clamp(scale(isVeryShortScreen ? 8 : 10), 6, 14);
  const cardRadius = clamp(scale(SIZES.radiusLarge), 14, 22);
  const iconBox = clamp(scale(isVeryShortScreen ? 36 : 44), 32, 48);
  const iconSize = clamp(scale(isVeryShortScreen ? 20 : 24), 16, 26);
  const enableButtonHeight = clamp(scale(isVeryShortScreen ? 40 : 46), 38, 50);
  const continueButtonHeight = clamp(scale(isVeryShortScreen ? 48 : 56), 44, 58);
  const descriptionSize = clamp(scale(isVeryShortScreen ? 10 : FONTS.sizes.small), 10, 13);
  const descriptionLineHeight = clamp(scale(isVeryShortScreen ? 14 : 18), 13, 18);
  const statusSize = clamp(scale(isVeryShortScreen ? 10 : FONTS.sizes.small), 10, 12);
  const titleSize = clamp(scale(isVeryShortScreen ? 13 : FONTS.sizes.regular), 13, 18);
  const enableTextSize = clamp(scale(isVeryShortScreen ? 10 : FONTS.sizes.small), 10, 13);
  const illustrationBottom = clamp(scale(isVeryShortScreen ? 4 : 8), 2, 12);
  const continueTopMargin = clamp(scale(isVeryShortScreen ? 6 : 10), 4, 12);
  const permissionsIllustration = require('../../assets/permissions-illustration.png');
  const locationPermissionIcon = require('../../assets/location-permission-icon.png');
  const notificationPermissionIcon = require('../../assets/notification-permission-icon.png');

  const { markPermissionsGranted } = useAuth();
  const { driver } = useDriver();

  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [continueLoading, setContinueLoading] = useState(false);

  useEffect(() => {
    const checkCurrentPermissions = async () => {
      try {
        const hasLocation = await permissionsService.checkLocationPermission();
        setLocationGranted(hasLocation);
        // Keep notifications disabled by default in onboarding UI until user taps Enable.
        setNotificationGranted(false);
      } catch (error) {
        console.error('Error checking permissions:', error);
        recordError(error, 'Permissions: check current permissions');
      }
    };

    checkCurrentPermissions();
  }, []);

  const handleEnableLocation = async () => {
    logBreadcrumb('Permissions: location tapped');
    setLocationLoading(true);
    const result = await permissionsService.requestLocationPermission();
    setLocationLoading(false);
    logBreadcrumb(`Permissions: location ${result.success ? 'granted' : 'denied'}`);

    if (result.success) {
      setLocationGranted(true);
      return;
    }

    Alert.alert(
      'Location Permission Required',
      'Location permission is required to find rides near you. Please enable it in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  };

  const handleEnableNotifications = async () => {
    logBreadcrumb('Permissions: notifications tapped');
    setNotificationLoading(true);
    const result = await permissionsService.requestNotificationPermission();
    setNotificationLoading(false);
    logBreadcrumb(
      `Permissions: notifications ${result.success ? 'granted' : 'denied'}`
    );

    if (result.success) {
      setNotificationGranted(true);
      return;
    }

    Alert.alert(
      'Notification Permission',
      'Notifications help you get ride and delivery updates. You can enable this later in Settings.',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  };

  const handleContinue = async () => {
    if (!locationGranted) {
      Alert.alert(
        'Location Needed',
        'Please enable location permission before continuing.'
      );
      return;
    }

    setContinueLoading(true);
    try {
      await markPermissionsGranted();
      const targetRoute = resolveDriverPostPermissionRoute(driver?.status);
      logBreadcrumb(`Permissions: navigating to ${targetRoute}`);
      navigation.replace(targetRoute);
    } finally {
      setContinueLoading(false);
    }
  };

  const renderPermissionCard = ({
    iconSource,
    title,
    description,
    enabled,
    loading,
    onEnable,
  }) => (
    <View
      style={[
        styles.permissionCard,
        { borderRadius: cardRadius, padding: cardPadding, marginBottom: cardSpacing },
        enabled && styles.permissionCardEnabled,
      ]}
    >
      <View style={[styles.permissionHeader, { marginBottom: cardSpacing }]}>
        <View
          style={[
            styles.iconContainer,
            { width: iconBox, height: iconBox, borderRadius: iconBox / 2, marginRight: cardSpacing + 2 },
            enabled && styles.iconContainerEnabled,
          ]}
        >
          <Image source={iconSource} style={[styles.iconImage, { width: iconSize, height: iconSize }]} />
        </View>
        <View style={styles.permissionTextWrap}>
          <Text style={[styles.permissionTitle, { fontSize: titleSize }]}>{title}</Text>
          <Text
            style={[
              styles.permissionDescription,
              { fontSize: descriptionSize, lineHeight: descriptionLineHeight, marginBottom: 4 },
            ]}
          >
            {description}
          </Text>
          <Text style={[styles.permissionStatus, { fontSize: statusSize }, enabled && styles.permissionStatusEnabled]}>
            {enabled ? 'Enabled' : 'Not enabled'}
          </Text>
        </View>
      </View>

      <Button
        title={enabled ? 'ENABLED' : 'ENABLE'}
        onPress={onEnable}
        loading={loading}
        disabled={enabled || loading}
        style={[styles.enableButton, { height: enableButtonHeight }]}
        textStyle={[styles.enableButtonText, { fontSize: enableTextSize }]}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={[styles.content, { paddingHorizontal: horizontalPadding, paddingVertical: verticalPadding }]}
        onLayout={(event) => {
          const nextHeight = Math.round(event.nativeEvent.layout.height);
          setContentHeight((prevHeight) => (Math.abs(prevHeight - nextHeight) > 1 ? nextHeight : prevHeight));
        }}
      >
        <View style={styles.mainSection}>
          <View style={[styles.illustrationContainer, { marginBottom: illustrationBottom }]}>
            <Image
              source={permissionsIllustration}
              style={[styles.illustrationImage, { width: imageWidth, height: imageHeight }]}
            />
          </View>

          <View style={styles.permissionsStack}>
            {renderPermissionCard({
              iconSource: locationPermissionIcon,
              title: 'Location Permission',
              description: 'Needed to find nearby rides and set pickup points.',
              enabled: locationGranted,
              loading: locationLoading,
              onEnable: handleEnableLocation,
            })}

            {renderPermissionCard({
              iconSource: notificationPermissionIcon,
              title: 'Notification Permission',
              description: 'Used for OTP, ride updates, and driver arrival alerts.',
              enabled: notificationGranted,
              loading: notificationLoading,
              onEnable: handleEnableNotifications,
            })}
          </View>
        </View>

        <Button
          title="CONTINUE"
          onPress={handleContinue}
          loading={continueLoading}
          disabled={!locationGranted || continueLoading}
          style={[styles.continueButton, { height: continueButtonHeight, marginTop: continueTopMargin }]}
        />
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
    justifyContent: 'space-between',
  },
  mainSection: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
  },
  illustrationImage: {
    resizeMode: 'contain',
  },
  permissionsStack: {
    marginBottom: 18,
  },
  permissionCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  permissionCardEnabled: {
    borderColor: COLORS.success,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerEnabled: {
    backgroundColor: '#E8F5E9',
  },
  iconImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  permissionTextWrap: {
    flex: 1,
  },
  permissionTitle: {
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  permissionDescription: {
    color: COLORS.textSecondary,
  },
  permissionStatus: {
    color: COLORS.textLight,
    fontWeight: '600',
  },
  permissionStatusEnabled: {
    color: COLORS.success,
  },
  enableButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
  },
  enableButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  continueButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
  },
});

export default PermissionsScreen;

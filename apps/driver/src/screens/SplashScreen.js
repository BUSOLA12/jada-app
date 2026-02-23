import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { COLORS } from '../utils/constants';
import { useAuth } from '../hooks/useAuth';
import Logo from '../../assets/jada-logo.svg';

SplashScreen.preventAutoHideAsync();

const SPLASH_MIN_DURATION_MS = 1000; // Minimum duration for the splash screen (1 second)

const SplashScreenComponent = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const { user, loading, permissionsGranted } = useAuth();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const logoSize = clamp(Math.round(Math.min(width, height) * 0.38), 150, 260);

  useEffect(() => {
    const prepare = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_DURATION_MS));
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    prepare();
  }, []);

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (permissionsGranted) {
          navigation.replace('Home');
        } else {
          navigation.replace('Permissions');
        }
      } else {
        navigation.replace('Welcome');
      }
    }
  }, [user, loading, permissionsGranted, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Logo width={logoSize} height={logoSize} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.orange,
  },
  logoContainer: {
    alignItems: 'center',
  },
});

export default SplashScreenComponent;

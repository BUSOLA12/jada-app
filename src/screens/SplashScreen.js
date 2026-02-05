import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { COLORS, SIZES, FONTS } from '../utils/constants';
import { useAuth } from '../hooks/useAuth';
import Logo from '../../assets/jada-logo.svg';

SplashScreen.preventAutoHideAsync();

const SPLASH_MIN_DURATION_MS = 4000;

const SplashScreenComponent = ({ navigation }) => {
  const { user, loading, permissionsGranted } = useAuth();

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
        <Logo width={200} height={200} />
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

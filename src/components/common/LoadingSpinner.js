import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS } from '../../utils/constants';

const LoadingSpinner = ({ text = '' }) => {
  const translateX = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 60,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -60,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [translateX]);

  return (
    <View style={styles.container}>
      <View style={styles.spinnerContainer}>
        <View style={styles.road}>
          <Animated.View style={[styles.car, { transform: [{ translateX }] }]}>
            <Text style={styles.carEmoji}>🚗</Text>
          </Animated.View>
        </View>

        {text ? (
          <Text style={styles.loadingText}>{text}</Text>
        ) : (
          <Text style={styles.loadingText}>Loading...</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  spinnerContainer: {
    alignItems: 'center',
  },
  road: {
    width: 180,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  car: {
    width: 40,
    alignItems: 'center',
  },
  carEmoji: {
    fontSize: 26,
  },
  loadingText: {
    fontSize: FONTS.sizes.regular,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

export default LoadingSpinner;

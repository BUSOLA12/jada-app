const androidMapsApiKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;

const iosMapsApiKey =
  process.env.GOOGLE_MAPS_IOS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY;

module.exports = ({ config }) => ({
  ...config,
  plugins: Array.from(
    new Set([
      ...(config.plugins || []),
      "@react-native-google-signin/google-signin",
      "@react-native-firebase/app",
      "@react-native-firebase/crashlytics",
    ])
  ),
  android: {
    ...config.android,
    config: {
      ...(config.android?.config || {}),
      ...(androidMapsApiKey
        ? {
            googleMaps: {
              ...((config.android?.config && config.android.config.googleMaps) || {}),
              apiKey: androidMapsApiKey,
            },
          }
        : {}),
    },
  },
  ios: {
    ...config.ios,
    config: {
      ...(config.ios?.config || {}),
      ...(iosMapsApiKey ? { googleMapsApiKey: iosMapsApiKey } : {}),
    },
  },
});

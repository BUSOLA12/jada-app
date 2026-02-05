import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { LogBox } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// export default function App() {
//   return (
//     <View style={styles.container}>
//       <StatusBar style="auto" />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#fff",
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
// });



// Ignore specific warnings (optional - removes console warnings that aren't critical)
LogBox.ignoreLogs([
  'AsyncStorage has been extracted',
  'EventEmitter.removeListener',
  'Possible Unhandled Promise Rejection',
  'Setting a timer',
  'Remote debugger',
]);

// Ignore all logs in production (optional)
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

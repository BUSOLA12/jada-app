import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

class PermissionsService {
  // Request location permission
  async requestLocationPermission() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        return {
          success: true,
          status: 'granted',
        };
      } else {
        return {
          success: false,
          status: status,
          message: 'Location permission is required to find nearby rides',
        };
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Request notification permission
  async requestNotificationPermission() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        // Configure notification handler
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        return {
          success: true,
          status: 'granted',
        };
      } else {
        return {
          success: false,
          status: finalStatus,
          message: 'Notification permission is required for ride updates',
        };
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Check if location permission is granted
  async checkLocationPermission() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  }

  // Check if notification permission is granted
  async checkNotificationPermission() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  }

  // Get current location
  async getCurrentLocation() {
    try {
      const hasPermission = await this.checkLocationPermission();
      
      if (!hasPermission) {
        return {
          success: false,
          message: 'Location permission not granted',
        };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        success: true,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new PermissionsService();
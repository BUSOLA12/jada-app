import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

class PermissionsService {
  mapLocationResult(locationObject) {
    return {
      latitude: locationObject.coords.latitude,
      longitude: locationObject.coords.longitude,
      accuracy: locationObject.coords.accuracy ?? 50,
    };
  }

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
  async getCurrentLocation(options = {}) {
    try {
      const hasPermission = await this.checkLocationPermission();
      
      if (!hasPermission) {
        return {
          success: false,
          message: 'Location permission not granted',
        };
      }

      const {
        preferLastKnown = true,
        maxAgeMs = 120000,
        requiredAccuracy = 250,
        accuracy = Location.Accuracy.Balanced,
      } = options;

      if (preferLastKnown) {
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: maxAgeMs,
            requiredAccuracy,
          });

          if (lastKnown) {
            return {
              success: true,
              location: this.mapLocationResult(lastKnown),
            };
          }
        } catch (error) {
          console.log('No valid last known location available:', error?.message);
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy,
        mayShowUserSettingsDialog: true,
      });

      return {
        success: true,
        location: this.mapLocationResult(location),
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

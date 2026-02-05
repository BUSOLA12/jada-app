import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS, SIZES, FONTS, SHADOWS } from '../utils/constants';
import permissionsService from '../services/permissionsService';
import { useAuth } from '../hooks/useAuth';
import { db } from '../../firebase.config';
import { doc, getDoc, updateDoc } from '@react-native-firebase/firestore';
import Input from '../components/common/Input';
import Button from '../components/common/Button';

const HomeScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const scaleBase = Math.min(width / 375, height / 812);
  const scale = (value) => Math.round(value * scaleBase);

  const buttonSize = clamp(scale(44), 38, 58);
  const headerTop = clamp(scale(10), 6, 16);
  const sheetRadius = clamp(scale(24), 18, 32);
  const sheetBottomPadding =
    Platform.OS === 'ios' ? clamp(scale(34), 24, 46) : clamp(scale(20), 16, 30);
  const handleWidth = clamp(scale(40), 32, 56);
  const handleHeight = clamp(scale(4), 3, 6);
  const handleMargin = clamp(scale(16), 12, 20);
  const bannerPadding = clamp(scale(16), 12, 22);
  const bannerMargin = clamp(scale(16), 12, 22);
  const searchPaddingV = clamp(scale(14), 10, 18);
  const searchPaddingH = clamp(scale(16), 12, 22);
  const searchRadius = clamp(scale(12), 10, 16);
  const menuPaddingTop =
    Platform.OS === 'ios' ? clamp(scale(60), 44, 76) : clamp(scale(40), 32, 60);
  const avatarSize = clamp(scale(60), 48, 76);
  const avatarMargin = clamp(scale(12), 8, 18);
  const menuItemPaddingV = clamp(scale(16), 12, 22);
  const modalPadding = clamp(scale(SIZES.padding), 16, 28);
  const { user, signOut } = useAuth();
  const mapRef = useRef(null);
  const [region, setRegion] = useState({
    latitude: 9.0820,
    longitude: 8.6753,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    getCurrentLocation();
    loadUserProfile();
  }, []);

  const getCurrentLocation = async () => {
    setLoading(true);
    const result = await permissionsService.getCurrentLocation();

    if (result.success) {
      const { latitude, longitude } = result.location;
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

      setCurrentLocation(result.location);
      setRegion(newRegion);

      mapRef.current?.animateToRegion(newRegion, 1000);
    }
    setLoading(false);
  };

  const loadUserProfile = async () => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists) {
        const data = userDoc.data();
        setUserProfile(data);
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setEmail(data.email || '');
      }
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        firstName,
        lastName,
        email,
        updatedAt: new Date().toISOString(),
      });

      Alert.alert('Success', 'Profile updated successfully');
      setShowProfileModal(false);
      loadUserProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleSignOut = async () => {
    setShowMenu(false);
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            navigation.replace('Welcome');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {currentLocation && (
          <Marker coordinate={currentLocation} title="Your Location" />
        )}
      </MapView>

      {/* Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={[styles.header, { paddingTop: headerTop }]}>
          <TouchableOpacity
            style={[
              styles.menuButton,
              { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
            ]}
            onPress={() => setShowMenu(true)}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
            ]}
          >
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <View
        style={[
          styles.bottomSheet,
          {
            borderTopLeftRadius: sheetRadius,
            borderTopRightRadius: sheetRadius,
            paddingBottom: sheetBottomPadding,
          },
        ]}
      >
        <View
          style={[
            styles.handleBar,
            {
              width: handleWidth,
              height: handleHeight,
              borderRadius: handleHeight / 2,
              marginBottom: handleMargin,
            },
          ]}
        />

        {/* Add Card Banner */}
        <View style={[styles.addCardBanner, { padding: bannerPadding, marginBottom: bannerMargin }]}>
          <Text style={styles.addCardText}>Add Card for easy payment</Text>
          <TouchableOpacity>
            <Text style={styles.addCardIcon}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View
          style={[
            styles.searchContainer,
            {
              paddingHorizontal: searchPaddingH,
              paddingVertical: searchPaddingV,
              borderRadius: searchRadius,
            },
          ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Where are you going to?"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>
      </View>

      {/* Side Menu Modal */}
      <Modal
        visible={showMenu}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={[styles.sideMenu, { paddingTop: menuPaddingTop }]}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Menu</Text>
              <TouchableOpacity onPress={() => setShowMenu(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileSection}>
              <View
                style={[
                  styles.profileAvatar,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    marginBottom: avatarMargin,
                  },
                ]}
              >
                <Text style={styles.avatarText}>
                  {firstName?.[0] || '👤'}
                </Text>
              </View>
              <Text style={styles.profileName}>
                {firstName || lastName
                  ? `${firstName} ${lastName}`
                  : user?.phoneNumber || 'Guest'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.menuItem, { paddingVertical: menuItemPaddingV }]}
              onPress={() => {
                setShowMenu(false);
                setShowProfileModal(true);
              }}
            >
              <Text style={styles.menuItemText}>✏️ Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { paddingVertical: menuItemPaddingV }]}>
              <Text style={styles.menuItemText}>🚗 My Rides</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { paddingVertical: menuItemPaddingV }]}>
              <Text style={styles.menuItemText}>💳 Payment Methods</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { paddingVertical: menuItemPaddingV }]}>
              <Text style={styles.menuItemText}>⚙️ Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.signOutItem, { paddingVertical: menuItemPaddingV }]}
              onPress={handleSignOut}
            >
              <Text style={[styles.menuItemText, styles.signOutText]}>
                🚪 Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.profileModalOverlay}>
          <View style={[styles.profileModal, { padding: modalPadding }]}>
            <View style={styles.profileModalHeader}>
              <Text style={styles.profileModalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Input
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter first name"
            />

            <Input
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter last name"
            />

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Button
              title="Save Changes"
              onPress={handleUpdateProfile}
              style={styles.saveButton}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingTop: 10,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  menuIcon: {
    fontSize: 20,
    color: COLORS.text,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  notificationIcon: {
    fontSize: 20,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SIZES.padding,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...SHADOWS.large,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  addCardBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.yellow,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  addCardText: {
    fontSize: FONTS.sizes.medium,
    color: COLORS.text,
    fontWeight: '500',
  },
  addCardIcon: {
    fontSize: 20,
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.regular,
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sideMenu: {
    width: '80%',
    height: '100%',
    backgroundColor: COLORS.white,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: FONTS.sizes.xlarge,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    fontSize: 28,
    color: COLORS.textSecondary,
  },
  profileSection: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 10,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 24,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: FONTS.sizes.large,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuItem: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemText: {
    fontSize: FONTS.sizes.regular,
    color: COLORS.text,
  },
  signOutItem: {
    marginTop: 20,
    borderBottomWidth: 0,
  },
  signOutText: {
    color: COLORS.error,
  },
  profileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModal: {
    width: '90%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    padding: SIZES.padding,
    maxHeight: '80%',
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileModalTitle: {
    fontSize: FONTS.sizes.xlarge,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.teal,
    marginTop: 10,
  },
});

export default HomeScreen;

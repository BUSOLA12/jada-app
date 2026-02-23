import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { COLORS, FONTS, SHADOWS, SIZES } from '../utils/constants';
import permissionsService from '../services/permissionsService';
import {
  autocompletePlaces,
  createPlacesSessionToken,
  getPlaceDetails,
  reverseGeocode,
} from '../services/googlePlacesService';
import { getFareEstimate } from '../services/fareService';
import { logBreadcrumb } from '../monitoring/crashlytics';
import { useAuth } from '../hooks/useAuth';
import { db } from '../../firebase.config';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import AlertOverlay from '../components/common/AlertOverlay';

const HOME_FLOW_STATES = Object.freeze({
  IDLE: 'IDLE',
  SAVED_PLACES: 'SAVED_PLACES',
  RECENT_DESTINATIONS: 'RECENT_DESTINATIONS',
  DESTINATION_SEARCH: 'DESTINATION_SEARCH',
  PICKUP_SELECTION: 'PICKUP_SELECTION',
  RIDE_OPTIONS: 'RIDE_OPTIONS',
});
const DESTINATION_SEARCH_MODES = Object.freeze({
  EMPTY: 'EMPTY',
  RESULTS: 'RESULTS',
  MAP_PICK: 'MAP_PICK',
  PREVIEW: 'PREVIEW',
});
const PICKUP_SEARCH_MODES = Object.freeze({
  DEFAULT: 'DEFAULT',
  MAP_PICK: 'MAP_PICK',
  PREVIEW: 'PREVIEW',
});
const DESTINATION_CATEGORY_PAGES = Object.freeze({
  NONE: 'NONE',
  SAVED: 'SAVED',
  RECENT: 'RECENT',
  POPULAR: 'POPULAR',
});

const SAVED_PLACES = [
  { id: 'home', label: 'Home', destination: 'Home Address' },
  { id: 'work', label: 'Work', destination: 'Work Address' },
];

const RECENT_DESTINATIONS = [
  {
    id: 'recent-1',
    title: 'Jabi Lake Mall',
    subtitle: 'Bala Sokoto Way, Abuja',
    coordinate: { latitude: 9.0764, longitude: 7.4263 },
  },
  {
    id: 'recent-2',
    title: 'Wuse Market',
    subtitle: 'Sani Abacha Way, Abuja',
    coordinate: { latitude: 9.0769, longitude: 7.4837 },
  },
  {
    id: 'recent-3',
    title: 'Maitama District',
    subtitle: 'Ibrahim Babangida Blvd, Abuja',
    coordinate: { latitude: 9.0924, longitude: 7.5002 },
  },
];
const RIDE_OPTIONS = [
  {
    id: 'economy',
    title: 'Economy',
    meta: '3 min away • Affordable daily rides',
    image: require('../../assets/welcome-journey.png'),
  },
  {
    id: 'comfort',
    title: 'Comfort',
    meta: '5 min away • Newer cars with extra legroom',
    image: require('../../assets/welcome-luxury.png'),
  },
  {
    id: 'xl',
    title: 'XL',
    meta: '7 min away • Extra seats for groups',
    image: require('../../assets/welcome-ride.png'),
  },
  {
    id: 'tricycle',
    title: 'Tricycle',
    meta: '2 min away • Fast short trips in busy areas',
    image: require('../../assets/welcome-tricycle.png'),
  },
];
const RIDE_OPTION_IDS = RIDE_OPTIONS.map((option) => option.id);
const DESTINATION_POIS = [
  {
    id: 'poi-1',
    title: 'Nnamdi Azikiwe Intl Airport',
    subtitle: 'Airport Rd, Abuja',
    coordinate: { latitude: 9.0056, longitude: 7.2632 },
  },
  {
    id: 'poi-2',
    title: 'Garki Area 11',
    subtitle: 'Abuja Municipal Area Council',
    coordinate: { latitude: 9.0406, longitude: 7.4922 },
  },
  {
    id: 'poi-3',
    title: 'Jabi Bus Terminal',
    subtitle: 'Jabi, Abuja',
    coordinate: { latitude: 9.0737, longitude: 7.4399 },
  },
  {
    id: 'poi-4',
    title: 'Banex Plaza',
    subtitle: 'Aminu Kano Cres, Abuja',
    coordinate: { latitude: 9.0859, longitude: 7.4745 },
  },
];
const DESTINATION_QUERY_DEBOUNCE_MS = 280;
const REVERSE_GEOCODE_DEBOUNCE_MS = 450;
const REVERSE_GEOCODE_MIN_MOVE_METERS = 20;
const REVERSE_GEOCODE_COOLDOWN_MS = 1200;
const REVERSE_GEOCODE_FORCE_MOVE_METERS = 50;
const PLUS_CODE_PATTERN = /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,}/i;
const COORDINATE_SUBTITLE_PATTERN = /^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/;
const WARNING_BORDER_TINT = `${COLORS.warning}73`;
const WARNING_BG_TINT = `${COLORS.warning}1F`;
const FAINT_TEAL_DIVIDER = `${COLORS.teal}14`;
const PICKUP_ROUTE_PATH_POINTS = 72;
const ROUTE_SWEEP_LOOP_DURATION_MS = 9000;
const ROUTE_PREVIEW_CONNECTOR_HEIGHT = 52;
const ROUTE_PREVIEW_PULSE_SIZE = 8;

const toRadians = (degrees) => (degrees * Math.PI) / 180;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

const buildPickupRoutePath = (startCoordinate, endCoordinate, points = PICKUP_ROUTE_PATH_POINTS) => {
  if (!startCoordinate || !endCoordinate) {
    return [];
  }

  const startLat = Number(startCoordinate.latitude);
  const startLng = Number(startCoordinate.longitude);
  const endLat = Number(endCoordinate.latitude);
  const endLng = Number(endCoordinate.longitude);
  if (![startLat, startLng, endLat, endLng].every(Number.isFinite)) {
    return [];
  }

  const latDelta = endLat - startLat;
  const lngDelta = endLng - startLng;
  const routeLength = Math.hypot(latDelta, lngDelta);
  if (routeLength === 0) {
    return [
      { latitude: startLat, longitude: startLng },
      { latitude: endLat, longitude: endLng },
    ];
  }

  // Creates a subtle bend so the path reads like a road instead of a rigid straight line.
  const perpendicularLat = -lngDelta / routeLength;
  const perpendicularLng = latDelta / routeLength;
  const curveMagnitude = Math.min(0.0032, Math.max(0.00008, routeLength * 0.12));
  const safePoints = Math.max(12, points);
  const path = [];

  for (let index = 0; index <= safePoints; index += 1) {
    const t = index / safePoints;
    const baseLat = startLat + latDelta * t;
    const baseLng = startLng + lngDelta * t;
    const curveOffset = Math.sin(Math.PI * t) * curveMagnitude;
    path.push({
      latitude: baseLat + perpendicularLat * curveOffset,
      longitude: baseLng + perpendicularLng * curveOffset,
    });
  }

  return path;
};

const getCoordinateAtProgress = (path, progress) => {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }
  if (path.length === 1) {
    return path[0];
  }

  const clampedProgress = clamp01(progress);
  const segmentCount = path.length - 1;
  const scaledIndex = clampedProgress * segmentCount;
  const leftIndex = Math.floor(scaledIndex);
  const rightIndex = Math.min(leftIndex + 1, segmentCount);
  const ratio = scaledIndex - leftIndex;
  const start = path[leftIndex];
  const end = path[rightIndex];

  return {
    latitude: start.latitude + (end.latitude - start.latitude) * ratio,
    longitude: start.longitude + (end.longitude - start.longitude) * ratio,
  };
};

const getPathThroughProgress = (path, progress) => {
  if (!Array.isArray(path) || path.length < 2) {
    return [];
  }

  const clampedProgress = clamp01(progress);
  if (clampedProgress <= 0) {
    return path.slice(0, 2);
  }
  if (clampedProgress >= 1) {
    return path;
  }

  const segmentCount = path.length - 1;
  const scaledIndex = clampedProgress * segmentCount;
  const leftIndex = Math.floor(scaledIndex);
  const rightIndex = Math.min(leftIndex + 1, segmentCount);
  const ratio = scaledIndex - leftIndex;
  const partialPath = path.slice(0, leftIndex + 1);
  const start = path[leftIndex];
  const end = path[rightIndex];

  if (start && end) {
    if (ratio > 0 && leftIndex !== rightIndex) {
      partialPath.push({
        latitude: start.latitude + (end.latitude - start.latitude) * ratio,
        longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      });
    } else if (rightIndex > leftIndex) {
      partialPath.push(end);
    }
  }

  return partialPath;
};
const haversineDistanceMeters = (a, b) => {
  const earthRadius = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const p =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
  return earthRadius * c;
};

const reverseGeocodeDistanceMeters = (from, to) => {
  if (!from || !to) {
    return Number.POSITIVE_INFINITY;
  }

  const lat1 = Number(from.lat);
  const lng1 = Number(from.lng);
  const lat2 = Number(to.lat);
  const lng2 = Number(to.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lng2 - lng1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);

  const p =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(startLat) * Math.cos(endLat);

  return earthRadius * (2 * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p)));
};

const isPlusCodeLike = (text) => {
  const value = String(text || '').trim();
  if (!value) {
    return false;
  }
  if (/plus code/i.test(value)) {
    return true;
  }
  return PLUS_CODE_PATTERN.test(value);
};

const getMapPickLabelQuality = (title, subtitle) => {
  const normalizedTitle = String(title || '').trim();
  const normalizedSubtitle = String(subtitle || '').trim();

  if (!normalizedTitle || isPlusCodeLike(normalizedTitle)) {
    return 0;
  }

  if (normalizedTitle.toLowerCase() === 'pinned location') {
    if (!normalizedSubtitle || COORDINATE_SUBTITLE_PATTERN.test(normalizedSubtitle)) {
      return 1;
    }
    return 2;
  }

  if (
    normalizedSubtitle &&
    !isPlusCodeLike(normalizedSubtitle) &&
    !COORDINATE_SUBTITLE_PATTERN.test(normalizedSubtitle)
  ) {
    return 4;
  }

  return 3;
};

const formatCoordinateSubtitle = ({ latitude, longitude }) =>
  `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

const buildPinnedDestination = (centerCoordinate) => {
  if (!centerCoordinate) {
    return null;
  }

  const nearestPoi = DESTINATION_POIS.reduce(
    (closest, poi) => {
      const distance = haversineDistanceMeters(centerCoordinate, poi.coordinate);
      if (!closest || distance < closest.distance) {
        return { poi, distance };
      }
      return closest;
    },
    null
  );

  if (nearestPoi && nearestPoi.distance <= 350) {
    return {
      id: `pin-near-${nearestPoi.poi.id}`,
      type: 'pin',
      source: 'map-pin',
      title: nearestPoi.poi.title,
      subtitle: nearestPoi.poi.subtitle,
      coordinate: {
        latitude: centerCoordinate.latitude,
        longitude: centerCoordinate.longitude,
      },
      tag: 'Pin',
    };
  }

  return {
    id: `pin-${Date.now()}`,
    type: 'pin',
    source: 'map-pin',
    title: 'Pinned location',
    subtitle: formatCoordinateSubtitle(centerCoordinate),
    coordinate: {
      latitude: centerCoordinate.latitude,
      longitude: centerCoordinate.longitude,
    },
    tag: 'Pin',
  };
};

const buildPickupCandidate = (centerCoordinate, options = {}) => {
  if (!centerCoordinate) {
    return null;
  }

  const latitude = Number(centerCoordinate.latitude);
  const longitude = Number(centerCoordinate.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id: options.id || `pickup-${Date.now()}`,
    type: 'pickup',
    source: 'pickup-pin',
    title: options.title || 'Pinned location',
    subtitle: options.subtitle || formatCoordinateSubtitle({ latitude, longitude }),
    coordinate: {
      latitude,
      longitude,
    },
    tag: 'Pickup',
  };
};
const EMAIL_REGEX =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const isValidEmail = (value) => {
  if (!EMAIL_REGEX.test(value)) {
    return false;
  }

  if (value.includes('..')) {
    return false;
  }

  const [localPart, domain] = value.split('@');
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return false;
  }

  const domainParts = domain.split('.');
  const topLevelDomain = domainParts[domainParts.length - 1];

  // App-level rule: require a 3+ letter TLD (e.g. ".com", ".org").
  return /^[A-Za-z]{3,24}$/.test(topLevelDomain);
};

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getDownloadURLWithRetry = async (reference, attempts = 4) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await reference.getDownloadURL();
    } catch (error) {
      lastError = error;
      if (error?.code !== 'storage/object-not-found' || attempt === attempts) {
        throw error;
      }
      await wait(250 * attempt);
    }
  }

  throw lastError || new Error('Unable to resolve download URL');
};

const getAvatarUploadErrorMessage = (error) => {
  const code = error?.code || '';
  const rawMessage = error?.message || '';

  if (rawMessage.includes('RNFBStorageModule') || rawMessage.includes('Native module')) {
    return 'Storage native module is unavailable. Rebuild and reinstall your dev client.';
  }

  if (code === 'storage/unauthorized') {
    return 'Upload blocked by Firebase Storage rules. Check Storage rules for authenticated users.';
  }

  if (code === 'storage/bucket-not-found') {
    return 'Storage bucket not found. Enable Firebase Storage and download latest google-services.json.';
  }

  if (code === 'storage/quota-exceeded') {
    return 'Storage quota exceeded. Try again later or check Firebase plan/quota.';
  }

  if (code === 'storage/retry-limit-exceeded') {
    return 'Network timeout while uploading image. Please retry.';
  }

  if (code === 'storage/invalid-url') {
    return 'Invalid image path selected. Please choose another image.';
  }

  if (code === 'storage/unknown') {
    return 'Storage returned an unknown error. Check Firebase console logs and device logcat.';
  }

  if (code === 'firestore/permission-denied') {
    return 'Image uploaded but profile save was denied by Firestore rules.';
  }

  if (rawMessage) {
    return `${code ? `${code}: ` : ''}${rawMessage}`;
  }

  return 'Unable to update profile picture. Please try again.';
};

const getLocationRowIconName = ({ type, source, tag, id }) => {
  if (id === 'home' || String(tag || '').toLowerCase() === 'saved') {
    return 'home';
  }
  if (id === 'work') {
    return 'work';
  }
  if (type === 'poi' || String(tag || '').toLowerCase() === 'poi') {
    return 'place';
  }
  if (type === 'recent' || source === 'recent' || String(tag || '').toLowerCase() === 'recent') {
    return 'history';
  }
  if (type === 'google' || source === 'google') {
    return 'location-on';
  }
  if (type === 'pin' || source === 'map-pin') {
    return 'room';
  }
  return 'location-on';
};

const HomeScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Simple responsive scaler:
  // We scale from a 375x812 baseline and then clamp key dimensions
  // so controls remain usable on both small and large screens.
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const availableHeight = Math.max(560, height - insets.top - insets.bottom);
  const scaleBase = Math.min(width / 375, availableHeight / 812);
  const scale = (value) => Math.round(value * scaleBase);

  const buttonSize = clamp(scale(44), 38, 58);
  const headerTop = clamp(scale(10), 6, 16);
  const headerHorizontal = clamp(scale(SIZES.padding), 14, 28);
  const panelRadius = clamp(scale(24), 18, 32);
  const panelPadding = clamp(scale(SIZES.padding), 14, 24);
  const collapsedPanelHeight = clamp(Math.round(availableHeight * 0.34), 230, 360);
  const expandedPanelHeight = clamp(
    Math.round(availableHeight * 0.9),
    380,
    availableHeight - clamp(scale(56), 48, 84)
  );
  const mapControlButtonSize = clamp(scale(46), 40, 58);
  const mapControlsRight = clamp(scale(14), 10, 24);
  const mapControlsBottom = collapsedPanelHeight + insets.bottom + clamp(scale(22), 18, 32);
  const menuPaddingTop = insets.top + (Platform.OS === 'ios' ? clamp(scale(18), 12, 24) : clamp(scale(12), 8, 18));
  const sideMenuWidth = clamp(Math.round(width * 0.82), 270, 420);
  const avatarSize = clamp(scale(60), 48, 76);
  const avatarMargin = clamp(scale(12), 8, 18);
  const menuItemPaddingV = clamp(scale(16), 12, 22);
  const modalPadding = clamp(scale(SIZES.padding), 16, 28);
  const profileModalWidth = Math.min(Math.round(width * 0.9), 520);
  const profileModalMaxHeight = clamp(Math.round(availableHeight * 0.94), 540, 900);

  const { user, signOut } = useAuth();

  useEffect(() => {
    logBreadcrumb('HomeScreen mounted');
  }, []);

  // Map ref for camera / region updates.
  const mapRef = useRef(null);

  // Refs used for smooth location marker/radius interpolation.
  const locationAnimationFrameRef = useRef(null);
  const animatedLocationRef = useRef(null);

  // Base map region (used before we fetch live location).
  const [region, setRegion] = useState({
    latitude: 9.082,
    longitude: 8.6753,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  // Raw GPS location from permissions service.
  const [currentLocation, setCurrentLocation] = useState(null);
  // Animated location used for smoother marker/ring transitions.
  const [animatedLocation, setAnimatedLocation] = useState(null);
  // Lock state to prevent repeated recenter taps during an active request.
  const [recentering, setRecentering] = useState(false);

  // Menu / modal visibility.
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileKeyboardVisible, setProfileKeyboardVisible] = useState(false);
  const profileModalMinHeight = profileKeyboardVisible
    ? clamp(Math.round(availableHeight * 0.55), 280, 420)
    : clamp(Math.round(availableHeight * 0.78), 460, 700);

  // Profile fields loaded from Firestore.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  const normalizedEmailForHint = email.trim().toLowerCase();
  const isTypedEmailValid =
    normalizedEmailForHint.length > 0 && isValidEmail(normalizedEmailForHint);
  const emailGuideMessage =
    normalizedEmailForHint.length === 0
      ? 'Use format: name@example.com (ending must be .com/.org etc).'
      : isTypedEmailValid
        ? 'Email format looks good.'
        : 'Invalid format. Example: name@example.com (3+ letter ending).';
  const profileInitial =
    firstName?.trim()?.[0] || lastName?.trim()?.[0] || user?.phoneNumber?.trim()?.[0] || 'U';

  // Temporary payment toggle for the fixed panel.
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [homeFlowState, setHomeFlowState] = useState(HOME_FLOW_STATES.IDLE);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [selectedDestinationDetails, setSelectedDestinationDetails] = useState(null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [debouncedDestinationQuery, setDebouncedDestinationQuery] = useState('');
  const [destinationSearchMode, setDestinationSearchMode] = useState(
    DESTINATION_SEARCH_MODES.EMPTY
  );
  const [destinationCategoryPage, setDestinationCategoryPage] = useState(
    DESTINATION_CATEGORY_PAGES.NONE
  );
  const [destinationPreview, setDestinationPreview] = useState(null);
  const [pinDropCandidate, setPinDropCandidate] = useState(null);
  const [showMapPoiMarkers, setShowMapPoiMarkers] = useState(false);
  const [placesSessionToken, setPlacesSessionToken] = useState('');
  const [googlePredictions, setGooglePredictions] = useState([]);
  const [isGoogleSearching, setIsGoogleSearching] = useState(false);
  const [isResolvingGooglePlace, setIsResolvingGooglePlace] = useState(false);
  const [pickupSearchMode, setPickupSearchMode] = useState(PICKUP_SEARCH_MODES.DEFAULT);
  const [pickupPinCandidate, setPickupPinCandidate] = useState(null);
  const [selectedPickupDetails, setSelectedPickupDetails] = useState(null);
  const [isReverseGeocodingPickup, setIsReverseGeocodingPickup] = useState(false);
  const [pickupQuery, setPickupQuery] = useState('');
  const [debouncedPickupQuery, setDebouncedPickupQuery] = useState('');
  const [pickupGooglePredictions, setPickupGooglePredictions] = useState([]);
  const [pickupPlacesSessionToken, setPickupPlacesSessionToken] = useState('');
  const [isPickupSearching, setIsPickupSearching] = useState(false);
  const [isResolvingPickupPlace, setIsResolvingPickupPlace] = useState(false);
  const [routeSweepProgress, setRouteSweepProgress] = useState(0);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareError, setFareError] = useState('');
  const [fareByOptionId, setFareByOptionId] = useState({});
  const [routeDurationSeconds, setRouteDurationSeconds] = useState(null);
  const [sheetSnapState, setSheetSnapState] = useState('collapsed');

  // Animated height for the custom snap panel.
  const panelHeightAnimRef = useRef(new Animated.Value(collapsedPanelHeight));
  const panelHeightAnim = panelHeightAnimRef.current;
  const dragStartHeightRef = useRef(collapsedPanelHeight);
  const currentDragHeightRef = useRef(collapsedPanelHeight);
  const latestAutocompleteReqIdRef = useRef(0);
  const reverseGeocodeTimerRef = useRef(null);
  const reverseGeocodeReqIdRef = useRef(0);
  const lastReverseGeocodeAtRef = useRef(0);
  const lastReverseGeocodeKeyRef = useRef('');
  const lastReverseGeocodeCenterRef = useRef(null);
  const pickupReverseTimerRef = useRef(null);
  const pickupReverseReqIdRef = useRef(0);
  const pickupLastGeocodeAtRef = useRef(0);
  const pickupLastKeyRef = useRef('');
  const pickupLastCenterRef = useRef(null);
  const routeSweepAnimationFrameRef = useRef(null);
  const routeSweepAnimationStartedAtRef = useRef(0);
  const routeSweepLastRenderAtRef = useRef(0);
  const routePreviewPulseAnim = useRef(new Animated.Value(0)).current;
  const routePreviewPulseLoopRef = useRef(null);
  const latestPickupAutocompleteReqIdRef = useRef(0);
  const previousHomeFlowStateRef = useRef(homeFlowState);
  const fareRequestKeyRef = useRef('');

  // Shared overlay message state used across actions.
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const getClampedAccuracyRadius = (accuracy) => Math.max(20, Math.min(accuracy ?? 60, 300));
  const animatePanelTo = (targetHeight) => {
    Animated.spring(panelHeightAnim, {
      toValue: targetHeight,
      useNativeDriver: false,
      tension: 120,
      friction: 18,
    }).start();
  };

  const snapToExpanded = () => {
    setSheetSnapState('expanded');
    currentDragHeightRef.current = expandedPanelHeight;
    animatePanelTo(expandedPanelHeight);
  };

  const snapToCollapsed = () => {
    setSheetSnapState('collapsed');
    currentDragHeightRef.current = collapsedPanelHeight;
    animatePanelTo(collapsedPanelHeight);
  };

  const togglePanelSnap = () => {
    if (sheetSnapState === 'expanded') {
      snapToCollapsed();
      return;
    }
    snapToExpanded();
  };

  const panelPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
        onPanResponderGrant: () => {
          panelHeightAnim.stopAnimation((value) => {
            dragStartHeightRef.current = value;
            currentDragHeightRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextHeight = clamp(
            dragStartHeightRef.current - gestureState.dy,
            collapsedPanelHeight,
            expandedPanelHeight
          );
          currentDragHeightRef.current = nextHeight;
          panelHeightAnim.setValue(nextHeight);
        },
        onPanResponderRelease: (_, gestureState) => {
          const midpoint = (collapsedPanelHeight + expandedPanelHeight) / 2;
          const shouldExpand =
            currentDragHeightRef.current > midpoint || gestureState.vy < -0.45;

          if (shouldExpand) {
            snapToExpanded();
            return;
          }

          snapToCollapsed();
        },
      }),
    [collapsedPanelHeight, expandedPanelHeight, panelHeightAnim]
  );

  const savedPlaces = useMemo(
    () =>
      SAVED_PLACES.map((place) => {
        if (place.id === 'home') {
          return {
            ...place,
            destination: homeAddress.trim() || place.destination,
          };
        }

        if (place.id === 'work') {
          return {
            ...place,
            destination: workAddress.trim() || place.destination,
          };
        }

        return place;
      }),
    [homeAddress, workAddress]
  );
  const hasHomeAddressSaved = homeAddress.trim().length > 0;
  const hasWorkAddressSaved = workAddress.trim().length > 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDestinationQuery(destinationQuery.trim());
    }, DESTINATION_QUERY_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [destinationQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPickupQuery(pickupQuery.trim());
    }, DESTINATION_QUERY_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [pickupQuery]);

  useEffect(() => {
    if (homeFlowState !== HOME_FLOW_STATES.DESTINATION_SEARCH) {
      return;
    }

    if (
      destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK ||
      destinationSearchMode === DESTINATION_SEARCH_MODES.PREVIEW
    ) {
      return;
    }

    setDestinationSearchMode(
      debouncedDestinationQuery.length > 0
        ? DESTINATION_SEARCH_MODES.RESULTS
        : DESTINATION_SEARCH_MODES.EMPTY
    );
  }, [debouncedDestinationQuery, destinationSearchMode, homeFlowState]);

  useEffect(() => {
    if (homeFlowState === HOME_FLOW_STATES.DESTINATION_SEARCH && !placesSessionToken) {
      setPlacesSessionToken(createPlacesSessionToken());
      return;
    }

    if (homeFlowState !== HOME_FLOW_STATES.DESTINATION_SEARCH) {
      latestAutocompleteReqIdRef.current += 1;
      if (placesSessionToken) {
        setPlacesSessionToken('');
      }
      setGooglePredictions([]);
      setIsGoogleSearching(false);
      setIsResolvingGooglePlace(false);
    }
  }, [homeFlowState, placesSessionToken]);

  useEffect(() => {
    if (homeFlowState === HOME_FLOW_STATES.PICKUP_SELECTION && !pickupPlacesSessionToken) {
      setPickupPlacesSessionToken(createPlacesSessionToken());
      return;
    }

    if (homeFlowState !== HOME_FLOW_STATES.PICKUP_SELECTION) {
      latestPickupAutocompleteReqIdRef.current += 1;
      setPickupQuery('');
      setDebouncedPickupQuery('');
      setPickupGooglePredictions([]);
      setPickupPlacesSessionToken('');
      setIsPickupSearching(false);
      setIsResolvingPickupPlace(false);
    }
  }, [homeFlowState, pickupPlacesSessionToken]);

  useEffect(() => {
    if (homeFlowState !== HOME_FLOW_STATES.DESTINATION_SEARCH) {
      return;
    }

    if (
      destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK ||
      destinationSearchMode === DESTINATION_SEARCH_MODES.PREVIEW
    ) {
      return;
    }

    const query = debouncedDestinationQuery.trim();
    if (query.length < 2) {
      latestAutocompleteReqIdRef.current += 1;
      setGooglePredictions([]);
      setIsGoogleSearching(false);
      return;
    }

    if (!placesSessionToken) {
      return;
    }

    const requestId = ++latestAutocompleteReqIdRef.current;
    setIsGoogleSearching(true);

    const bias = currentLocation
      ? {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
          radiusMeters: 30000,
        }
      : {
          lat: region.latitude,
          lng: region.longitude,
          radiusMeters: 30000,
        };

    (async () => {
      try {
        const data = await autocompletePlaces({
          input: query,
          sessionToken: placesSessionToken,
          locationBias: bias,
          regionCode: 'NG',
        });

        if (requestId !== latestAutocompleteReqIdRef.current) {
          return;
        }

        const mappedPredictions = (data?.predictions || [])
          .map((prediction) => ({
            id: `google-${prediction.placeId}`,
            type: 'google',
            source: 'google',
            tag: 'Google',
            title: prediction.primaryText,
            subtitle: prediction.secondaryText || '',
            placeId: prediction.placeId,
            coordinate: null,
            data: prediction,
          }))
          .filter((prediction) => prediction.placeId && prediction.title);

        setGooglePredictions(mappedPredictions);
      } catch (error) {
        if (requestId !== latestAutocompleteReqIdRef.current) {
          return;
        }
        setGooglePredictions([]);
        console.warn('Google Places autocomplete error:', error);
      } finally {
        if (requestId === latestAutocompleteReqIdRef.current) {
          setIsGoogleSearching(false);
        }
      }
    })();
  }, [
    currentLocation,
    debouncedDestinationQuery,
    destinationSearchMode,
    homeFlowState,
    placesSessionToken,
    region.latitude,
    region.longitude,
  ]);

  useEffect(() => {
    if (homeFlowState !== HOME_FLOW_STATES.PICKUP_SELECTION) {
      return;
    }

    if (pickupSearchMode === PICKUP_SEARCH_MODES.MAP_PICK) {
      return;
    }

    const query = debouncedPickupQuery.trim();
    if (query.length < 2) {
      latestPickupAutocompleteReqIdRef.current += 1;
      setPickupGooglePredictions([]);
      setIsPickupSearching(false);
      return;
    }

    if (!pickupPlacesSessionToken) {
      return;
    }

    const requestId = ++latestPickupAutocompleteReqIdRef.current;
    setIsPickupSearching(true);

    const bias = currentLocation
      ? {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
          radiusMeters: 30000,
        }
      : {
          lat: region.latitude,
          lng: region.longitude,
          radiusMeters: 30000,
        };

    (async () => {
      try {
        const data = await autocompletePlaces({
          input: query,
          sessionToken: pickupPlacesSessionToken,
          locationBias: bias,
          regionCode: 'NG',
        });

        if (requestId !== latestPickupAutocompleteReqIdRef.current) {
          return;
        }

        const mappedPredictions = (data?.predictions || [])
          .map((prediction) => ({
            id: `pickup-google-${prediction.placeId}`,
            type: 'google',
            source: 'google',
            tag: 'Google',
            title: prediction.primaryText,
            subtitle: prediction.secondaryText || '',
            placeId: prediction.placeId,
            coordinate: null,
            data: prediction,
          }))
          .filter((prediction) => prediction.placeId && prediction.title);

        setPickupGooglePredictions(mappedPredictions);
      } catch (error) {
        if (requestId !== latestPickupAutocompleteReqIdRef.current) {
          return;
        }
        setPickupGooglePredictions([]);
        console.warn('Pickup places autocomplete error:', error);
      } finally {
        if (requestId === latestPickupAutocompleteReqIdRef.current) {
          setIsPickupSearching(false);
        }
      }
    })();
  }, [
    currentLocation,
    debouncedPickupQuery,
    homeFlowState,
    pickupPlacesSessionToken,
    pickupSearchMode,
    region.latitude,
    region.longitude,
  ]);

  const localDestinationSearchResults = useMemo(() => {
    const query = debouncedDestinationQuery.toLowerCase();
    if (!query) {
      return [];
    }

    const savedMatches = savedPlaces
      .filter(
        (place) =>
          place.label.toLowerCase().includes(query) || place.destination.toLowerCase().includes(query)
      )
      .map((place) => ({
        id: `saved-${place.id}`,
        type: 'saved',
        title: place.destination,
        subtitle: place.label,
        tag: 'Saved',
        source: 'saved',
        coordinate: null,
        data: place,
      }));

    const recentMatches = RECENT_DESTINATIONS.filter(
      (destination) =>
        destination.title.toLowerCase().includes(query) ||
        destination.subtitle.toLowerCase().includes(query)
    ).map((destination) => ({
      id: `recent-${destination.id}`,
      type: 'recent',
      title: destination.title,
      subtitle: destination.subtitle,
      tag: 'Recent',
      source: 'recent',
      coordinate: destination.coordinate,
      data: destination,
    }));

    const poiMatches = DESTINATION_POIS.filter(
      (destination) =>
        destination.title.toLowerCase().includes(query) ||
        destination.subtitle.toLowerCase().includes(query)
    ).map((destination) => ({
      id: destination.id,
      type: 'poi',
      title: destination.title,
      subtitle: destination.subtitle,
      tag: 'POI',
      source: 'poi',
      coordinate: destination.coordinate,
      data: destination,
    }));

    return [...savedMatches, ...recentMatches, ...poiMatches].slice(0, 10);
  }, [debouncedDestinationQuery, savedPlaces]);

  const destinationSearchResults = useMemo(() => {
    if (!debouncedDestinationQuery.trim()) {
      return [];
    }

    const seen = new Set();
    const combinedResults = [];

    [...googlePredictions, ...localDestinationSearchResults].forEach((result) => {
      const dedupeKey = `${result.title}::${result.subtitle}`;
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);
      combinedResults.push(result);
    });

    return combinedResults.slice(0, 12);
  }, [debouncedDestinationQuery, googlePredictions, localDestinationSearchResults]);

  const pickupSearchResults = useMemo(() => {
    const query = debouncedPickupQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const recentMatches = RECENT_DESTINATIONS.filter(
      (destination) =>
        destination.title.toLowerCase().includes(query) ||
        destination.subtitle.toLowerCase().includes(query)
    ).map((destination) => ({
      id: `pickup-recent-${destination.id}`,
      type: 'recent',
      source: 'recent',
      tag: 'Recent',
      title: destination.title,
      subtitle: destination.subtitle,
      coordinate: destination.coordinate,
      data: destination,
    }));

    const seen = new Set();
    const combinedResults = [];
    [...pickupGooglePredictions, ...recentMatches].forEach((result) => {
      const dedupeKey = `${result.title}::${result.subtitle}`;
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);
      combinedResults.push(result);
    });

    return combinedResults.slice(0, 12);
  }, [debouncedPickupQuery, pickupGooglePredictions]);

  const mapPoiResults = useMemo(() => {
    const query = debouncedDestinationQuery.toLowerCase();
    const results = query
      ? DESTINATION_POIS.filter(
          (poi) =>
            poi.title.toLowerCase().includes(query) || poi.subtitle.toLowerCase().includes(query)
        )
      : DESTINATION_POIS;

    return results.slice(0, 8);
  }, [debouncedDestinationQuery]);

  const visibleMapPoiMarkers = useMemo(() => {
    if (
      homeFlowState !== HOME_FLOW_STATES.DESTINATION_SEARCH ||
      destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK ||
      !showMapPoiMarkers
    ) {
      return [];
    }

    return mapPoiResults;
  }, [destinationSearchMode, homeFlowState, mapPoiResults, showMapPoiMarkers]);

  const shouldShowRideRoutePreview = useMemo(() => {
    return (
      homeFlowState === HOME_FLOW_STATES.RIDE_OPTIONS &&
      Boolean(selectedPickupDetails?.coordinate) &&
      Boolean(selectedDestinationDetails?.coordinate)
    );
  }, [homeFlowState, selectedDestinationDetails?.coordinate, selectedPickupDetails?.coordinate]);

  const pickupAnimationStartCoordinate = useMemo(() => {
    return selectedPickupDetails?.coordinate || null;
  }, [selectedPickupDetails?.coordinate]);

  const pickupToDestinationRoutePath = useMemo(() => {
    if (!shouldShowRideRoutePreview) {
      return [];
    }

    if (!pickupAnimationStartCoordinate || !selectedDestinationDetails?.coordinate) {
      return [];
    }

    return buildPickupRoutePath(
      pickupAnimationStartCoordinate,
      selectedDestinationDetails.coordinate
    );
  }, [
    shouldShowRideRoutePreview,
    pickupAnimationStartCoordinate,
    selectedDestinationDetails?.coordinate,
  ]);
  const animatedRouteHighlightPath = useMemo(() => {
    return getPathThroughProgress(pickupToDestinationRoutePath, routeSweepProgress);
  }, [pickupToDestinationRoutePath, routeSweepProgress]);
  const routeSweepHeadCoordinate = useMemo(() => {
    return getCoordinateAtProgress(pickupToDestinationRoutePath, routeSweepProgress);
  }, [pickupToDestinationRoutePath, routeSweepProgress]);
  const rideOptionEtaById = useMemo(() => {
    const durationSecondsValue = Number(routeDurationSeconds);
    if (!Number.isFinite(durationSecondsValue) || durationSecondsValue <= 0) {
      return {};
    }

    const routeMinutes = Math.max(1, Math.round(durationSecondsValue / 60));
    const baseEtaMinutes = Math.max(2, Math.min(14, Math.round(routeMinutes * 0.18) + 2));

    return {
      economy: baseEtaMinutes,
      comfort: baseEtaMinutes + 2,
      xl: baseEtaMinutes + 4,
      tricycle: Math.max(1, baseEtaMinutes - 1),
    };
  }, [routeDurationSeconds]);
  const getRideOptionMetaText = (rideOption) => {
    const meta = String(rideOption?.meta || '').trim();
    const metaParts = meta.split('•');
    const description =
      metaParts.length > 1 ? metaParts.slice(1).join('•').trim() : meta;
    const etaMinutes = rideOptionEtaById?.[rideOption?.id];
    if (!Number.isFinite(etaMinutes)) {
      return meta;
    }
    return `${etaMinutes} min away • ${description}`;
  };

  const routePreviewPulseTranslateY = useMemo(
    () =>
      routePreviewPulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, ROUTE_PREVIEW_CONNECTOR_HEIGHT - ROUTE_PREVIEW_PULSE_SIZE],
      }),
    [routePreviewPulseAnim]
  );
  const routePreviewPulseOpacity = useMemo(
    () =>
      routePreviewPulseAnim.interpolate({
        inputRange: [0, 0.08, 0.9, 1],
        outputRange: [0, 1, 1, 0],
      }),
    [routePreviewPulseAnim]
  );

  // Smoothly interpolates marker position and accuracy radius instead of
  // jumping each time a new location arrives.
  const animateLocationOverlay = (nextLocation, duration = 550) => {
    if (!nextLocation) {
      return;
    }

    const next = {
      latitude: nextLocation.latitude,
      longitude: nextLocation.longitude,
      radius: getClampedAccuracyRadius(nextLocation.accuracy),
    };
    const prev = animatedLocationRef.current;

    if (!prev) {
      animatedLocationRef.current = next;
      setAnimatedLocation(next);
      return;
    }

    if (locationAnimationFrameRef.current) {
      cancelAnimationFrame(locationAnimationFrameRef.current);
      locationAnimationFrameRef.current = null;
    }

    const startAt = Date.now();
    const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

    const tick = () => {
      const elapsed = Date.now() - startAt;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutQuad(progress);
      const interpolated = {
        latitude: prev.latitude + (next.latitude - prev.latitude) * eased,
        longitude: prev.longitude + (next.longitude - prev.longitude) * eased,
        radius: prev.radius + (next.radius - prev.radius) * eased,
      };

      animatedLocationRef.current = interpolated;
      setAnimatedLocation(interpolated);

      if (progress < 1) {
        locationAnimationFrameRef.current = requestAnimationFrame(tick);
      } else {
        animatedLocationRef.current = next;
        setAnimatedLocation(next);
        locationAnimationFrameRef.current = null;
      }
    };

    locationAnimationFrameRef.current = requestAnimationFrame(tick);
  };

  // Initial screen boot: fetch location and user profile.
  useEffect(() => {
    getCurrentLocation();
    loadUserProfile();
  }, []);

  // Re-animate overlay whenever we receive a new current location.
  useEffect(() => {
    if (currentLocation) {
      animateLocationOverlay(currentLocation);
    }
  }, [currentLocation]);

  // Cancel any pending animation frame on unmount.
  useEffect(
    () => () => {
      if (locationAnimationFrameRef.current) {
        cancelAnimationFrame(locationAnimationFrameRef.current);
      }
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current);
      }
      if (pickupReverseTimerRef.current) {
        clearTimeout(pickupReverseTimerRef.current);
      }
      if (routeSweepAnimationFrameRef.current) {
        cancelAnimationFrame(routeSweepAnimationFrameRef.current);
      }
      if (routePreviewPulseLoopRef.current) {
        routePreviewPulseLoopRef.current.stop();
      }
      routePreviewPulseAnim.stopAnimation();
    },
    []
  );

  useEffect(() => {
    if (
      homeFlowState === HOME_FLOW_STATES.DESTINATION_SEARCH &&
      destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK
    ) {
      return;
    }

    if (reverseGeocodeTimerRef.current) {
      clearTimeout(reverseGeocodeTimerRef.current);
      reverseGeocodeTimerRef.current = null;
    }
    reverseGeocodeReqIdRef.current += 1;
  }, [destinationSearchMode, homeFlowState]);

  useEffect(() => {
    const previousState = previousHomeFlowStateRef.current;
    const isEnteringPickupSelection =
      previousState !== HOME_FLOW_STATES.PICKUP_SELECTION &&
      homeFlowState === HOME_FLOW_STATES.PICKUP_SELECTION;
    const isLeavingPickupSelection =
      previousState === HOME_FLOW_STATES.PICKUP_SELECTION &&
      homeFlowState !== HOME_FLOW_STATES.PICKUP_SELECTION;

    previousHomeFlowStateRef.current = homeFlowState;

    if (isLeavingPickupSelection) {
      if (pickupReverseTimerRef.current) {
        clearTimeout(pickupReverseTimerRef.current);
        pickupReverseTimerRef.current = null;
      }
      pickupReverseReqIdRef.current += 1;
      setPickupSearchMode(PICKUP_SEARCH_MODES.DEFAULT);
      setIsReverseGeocodingPickup(false);
      return;
    }

    if (!isEnteringPickupSelection) {
      return;
    }

    if (pickupReverseTimerRef.current) {
      clearTimeout(pickupReverseTimerRef.current);
      pickupReverseTimerRef.current = null;
    }

    pickupReverseReqIdRef.current += 1;
    pickupLastGeocodeAtRef.current = 0;
    pickupLastKeyRef.current = '';
    pickupLastCenterRef.current = null;
    setPickupSearchMode(PICKUP_SEARCH_MODES.DEFAULT);
    setSelectedPickupDetails(null);

    if (!currentLocation) {
      setPickupPinCandidate(null);
      return;
    }

    setPickupPinCandidate(
      buildPickupCandidate(currentLocation, {
        title: 'Current location',
        subtitle: 'Finding address...',
      })
    );
  }, [currentLocation, homeFlowState]);

  useEffect(() => {
    if (homeFlowState !== HOME_FLOW_STATES.PICKUP_SELECTION) {
      return;
    }
    if (!currentLocation || pickupPinCandidate || selectedPickupDetails) {
      return;
    }

    setPickupPinCandidate(
      buildPickupCandidate(currentLocation, {
        title: 'Current location',
        subtitle: 'Finding address...',
      })
    );
  }, [currentLocation, homeFlowState, pickupPinCandidate, selectedPickupDetails]);

  useEffect(() => {
    if (homeFlowState !== HOME_FLOW_STATES.RIDE_OPTIONS) {
      return;
    }

    const pickupLat = Number(selectedPickupDetails?.coordinate?.latitude);
    const pickupLng = Number(selectedPickupDetails?.coordinate?.longitude);
    const destinationLat = Number(selectedDestinationDetails?.coordinate?.latitude);
    const destinationLng = Number(selectedDestinationDetails?.coordinate?.longitude);

    if (
      !Number.isFinite(pickupLat) ||
      !Number.isFinite(pickupLng) ||
      !Number.isFinite(destinationLat) ||
      !Number.isFinite(destinationLng)
    ) {
      return;
    }

    const requestKey = `${pickupLat},${pickupLng}|${destinationLat},${destinationLng}`;
    if (fareRequestKeyRef.current === requestKey) {
      return;
    }

    fareRequestKeyRef.current = requestKey;
    let cancelled = false;

    const fetchFares = async () => {
      setFareLoading(true);
      setFareError('');

      try {
        const payload = await getFareEstimate({
          pickup: { lat: pickupLat, lng: pickupLng },
          destination: { lat: destinationLat, lng: destinationLng },
          options: RIDE_OPTION_IDS,
        });

        if (cancelled) {
          return;
        }

        const nextFareByOptionId = {};
        const nextDurationSeconds = Number(payload?.durationSeconds);
        const estimates = Array.isArray(payload?.estimates) ? payload.estimates : [];
        estimates.forEach((estimate) => {
          const optionId = String(estimate?.id || '').trim().toLowerCase();
          if (!optionId) {
            return;
          }
          nextFareByOptionId[optionId] = {
            fare: Number(estimate?.fare || 0),
            formatted: String(estimate?.formatted || ''),
          };
        });
        setRouteDurationSeconds(
          Number.isFinite(nextDurationSeconds) && nextDurationSeconds > 0
            ? nextDurationSeconds
            : null
        );
        setFareByOptionId(nextFareByOptionId);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setRouteDurationSeconds(null);
        setFareByOptionId({});
        setFareError(error?.message || 'Unable to fetch fare estimate.');
        fareRequestKeyRef.current = '';
      } finally {
        if (!cancelled) {
          setFareLoading(false);
        }
      }
    };

    fetchFares();

    return () => {
      cancelled = true;
    };
  }, [
    homeFlowState,
    selectedPickupDetails?.coordinate?.latitude,
    selectedPickupDetails?.coordinate?.longitude,
    selectedDestinationDetails?.coordinate?.latitude,
    selectedDestinationDetails?.coordinate?.longitude,
  ]);

  useEffect(() => {
    if (homeFlowState !== HOME_FLOW_STATES.RIDE_OPTIONS) {
      if (routePreviewPulseLoopRef.current) {
        routePreviewPulseLoopRef.current.stop();
        routePreviewPulseLoopRef.current = null;
      }
      routePreviewPulseAnim.stopAnimation();
      routePreviewPulseAnim.setValue(0);
      return;
    }

    routePreviewPulseAnim.setValue(0);
    const pulseLoop = Animated.loop(
      Animated.timing(routePreviewPulseAnim, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    routePreviewPulseLoopRef.current = pulseLoop;
    pulseLoop.start();

    return () => {
      if (routePreviewPulseLoopRef.current) {
        routePreviewPulseLoopRef.current.stop();
        routePreviewPulseLoopRef.current = null;
      }
      routePreviewPulseAnim.stopAnimation();
      routePreviewPulseAnim.setValue(0);
    };
  }, [homeFlowState, routePreviewPulseAnim]);

  // Keep panel height aligned with current snap state when dimensions change.
  useEffect(() => {
    const targetHeight = sheetSnapState === 'expanded' ? expandedPanelHeight : collapsedPanelHeight;
    panelHeightAnim.setValue(targetHeight);
    currentDragHeightRef.current = targetHeight;
    dragStartHeightRef.current = targetHeight;
  }, [collapsedPanelHeight, expandedPanelHeight, panelHeightAnim, sheetSnapState]);

  // Keep profile modal height responsive to keyboard visibility.
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setProfileKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setProfileKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // One-time location fetch used on startup and manual retries.
  const getCurrentLocation = async () => {
    const result = await permissionsService.getCurrentLocation();

    if (result.success && result.location) {
      const { latitude, longitude } = result.location;
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

      setCurrentLocation(result.location);
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 900);
    }
  };

  // Utility to center map on a coordinate with tighter zoom.
  const centerMapOnLocation = (location, duration = 600) => {
    const nextRegion = {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };

    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, duration);
  };

  // Reads profile document for current user and pre-fills edit form.
  const loadUserProfile = async () => {
    if (!user?.uid) {
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists) {
      return;
    }

    const data = userDoc.data();
    setFirstName(data.firstName || '');
    setLastName(data.lastName || '');
    setEmail(data.email || '');
    setHomeAddress(data.homeAddress || data.profile?.homeAddress || '');
    setWorkAddress(data.workAddress || data.profile?.workAddress || '');
    setAvatarUrl(data.avatarUrl || data.profile?.avatarUrl || '');
  };

  // Ensures media permission with a small in-memory cache.
  // This avoids calling the request API on every avatar tap.
  const ensureMediaLibraryPermission = async () => {
    if (hasMediaLibraryPermission === true) {
      return true;
    }

    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) {
      setHasMediaLibraryPermission(true);
      return true;
    }

    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setHasMediaLibraryPermission(requested.granted);
    return requested.granted;
  };

  // Opens media library, uploads selected avatar to Firebase Storage,
  // then stores the public URL in the user's Firestore profile document.
  const handlePickAvatar = async () => {
    if (!user?.uid || isUploadingAvatar || isPickingAvatar) {
      return;
    }

    setIsPickingAvatar(true);

    try {
      const granted = await ensureMediaLibraryPermission();
      if (!granted) {
        setAlertState({
          visible: true,
          type: 'info',
          title: 'Permission required',
          message: 'Please allow photo access to update your profile picture.',
        });
        return;
      }

      const pickResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (pickResult.canceled || !pickResult.assets?.length) {
        return;
      }

      const asset = pickResult.assets[0];
      if (!asset?.uri) {
        throw new Error('No image URI returned from picker');
      }

      setIsUploadingAvatar(true);

      const extensionFromName = asset.fileName?.split('.').pop()?.toLowerCase();
      const extension = extensionFromName || 'jpg';
      const uploadPath = `avatars/${user.uid}/avatar-${Date.now()}.${extension}`;
      const reference = storage().ref(uploadPath);
      const uploadUri =
        Platform.OS === 'ios' && asset.uri.startsWith('file://')
          ? asset.uri.replace('file://', '')
          : asset.uri;
      const contentType = asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      console.log('Avatar upload target:', {
        bucket: reference.bucket,
        fullPath: reference.fullPath,
        hasBase64: Boolean(asset.base64),
        uriScheme: asset.uri?.split(':')?.[0] || 'unknown',
      });

      const uploadSnapshot = asset.base64
        ? await reference.putString(asset.base64, 'base64', { contentType })
        : await reference.putFile(uploadUri, { contentType });

      console.log('Avatar upload snapshot:', {
        bucket: uploadSnapshot?.metadata?.bucket,
        fullPath: uploadSnapshot?.metadata?.fullPath,
        size: uploadSnapshot?.totalBytes,
      });

      const downloadUrl = await getDownloadURLWithRetry(uploadSnapshot?.ref || reference);

      await setDoc(
        doc(db, 'users', user.uid),
        {
          avatarUrl: downloadUrl,
          profile: {
            avatarUrl: downloadUrl,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setAvatarUrl(downloadUrl);
      setAlertState({
        visible: true,
        type: 'success',
        title: 'Avatar updated',
        message: 'Your profile picture has been updated successfully.',
      });
    } catch (error) {
      console.log('Avatar upload error:', {
        code: error?.code,
        message: error?.message,
      });
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Avatar update failed',
        message: getAvatarUploadErrorMessage(error),
      });
    } finally {
      setIsPickingAvatar(false);
      setIsUploadingAvatar(false);
    }
  };

  // Persists profile fields and shows success/error overlay.
  const handleUpdateProfile = async () => {
    if (isSavingProfile) {
      return;
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors = {
      firstName: '',
      lastName: '',
      email: '',
    };

    if (!normalizedFirstName) {
      nextErrors.firstName = 'First name is required';
    }

    if (!normalizedLastName) {
      nextErrors.lastName = 'Last name is required';
    }

    if (!normalizedEmail) {
      nextErrors.email = 'Email is required';
    } else if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address';
    }

    setProfileErrors(nextErrors);

    if (nextErrors.firstName || nextErrors.lastName || nextErrors.email) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Invalid profile details',
        message: 'First name, last name, and a valid email are required.',
      });
      return;
    }

    setIsSavingProfile(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      const normalizedHomeAddress = homeAddress.trim();
      const normalizedWorkAddress = workAddress.trim();

      await setDoc(
        userRef,
        {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          email: normalizedEmail,
          homeAddress: normalizedHomeAddress,
          workAddress: normalizedWorkAddress,
          profile: {
            homeAddress: normalizedHomeAddress,
            workAddress: normalizedWorkAddress,
            avatarUrl: avatarUrl || '',
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setAlertState({
        visible: true,
        type: 'success',
        title: 'Profile updated',
        message: 'Your profile has been updated successfully.',
      });
      setShowProfileModal(false);
    } catch (error) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Update failed',
        message: 'Failed to update profile. Please try again.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Sign-out flow with confirmation dialog.
  const handleSignOut = async () => {
    setShowMenu(false);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          navigation.replace('Welcome');
        },
      },
    ]);
  };

  // Recenter map quickly using last-known location first, then fresher GPS.
  const handleRecenter = async () => {
    if (currentLocation) {
      centerMapOnLocation(currentLocation, 350);
    }

    if (recentering) {
      return;
    }

    setRecentering(true);

    const result = await permissionsService.getCurrentLocation({
      preferLastKnown: true,
      maxAgeMs: 90000,
      requiredAccuracy: 150,
    });

    if (result.success && result.location) {
      setCurrentLocation(result.location);
      centerMapOnLocation(result.location, currentLocation ? 450 : 700);
    } else if (!currentLocation) {
      setAlertState({
        visible: true,
        type: 'error',
        title: 'Location unavailable',
        message: result.message || result.error || 'Unable to get your location right now.',
      });
    }

    setRecentering(false);
  };

  // Reset map bearing/pitch so the map faces north again.
  const handleResetCompass = async () => {
    if (!mapRef.current) {
      return;
    }

    try {
      const camera = await mapRef.current.getCamera();
      mapRef.current.animateCamera(
        {
          ...camera,
          heading: 0,
          pitch: 0,
        },
        { duration: 500 }
      );
    } catch (error) {
      const center = currentLocation
        ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }
        : {
            latitude: region.latitude,
            longitude: region.longitude,
          };

      mapRef.current?.animateCamera(
        {
          center,
          heading: 0,
          pitch: 0,
          zoom: 16,
        },
        { duration: 500 }
      );
    }
  };

const handleSchedulePress = () => {
    setAlertState({
      visible: true,
      type: 'info',
      title: 'Schedule pickup',
      message: 'Pickup scheduling will be enabled in the next state iteration.',
    });
  };

  const ensureSavedPlaceAvailable = (place) => {
    const hasHomeAddress = homeAddress.trim().length > 0;
    const hasWorkAddress = workAddress.trim().length > 0;

    if (place.id === 'home' && !hasHomeAddress) {
      setAlertState({
        visible: true,
        type: 'info',
        title: 'Home address missing',
        message: 'Please add your home address in your profile.',
      });
      return false;
    }

    if (place.id === 'work' && !hasWorkAddress) {
      setAlertState({
        visible: true,
        type: 'info',
        title: 'Work address missing',
        message: 'Please add your work address in your profile.',
      });
      return false;
    }

    return true;
  };

  const createDestinationPayload = (result, fallbackSource = 'typed') => ({
    id: result.id || `destination-${Date.now()}`,
    type: result.type || 'poi',
    source: result.source || fallbackSource,
    title: result.title,
    subtitle: result.subtitle || '',
    coordinate: result.coordinate || null,
    tag: result.tag || 'Place',
  });

  // Transition: Idle -> Destination Search.
  const handleDestinationPress = () => {
    setDestinationQuery('');
    setDebouncedDestinationQuery('');
    setDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.NONE);
    setDestinationPreview(null);
    setPinDropCandidate(null);
    setShowMapPoiMarkers(false);
    setPlacesSessionToken(createPlacesSessionToken());
    setGooglePredictions([]);
    setIsGoogleSearching(false);
    setIsResolvingGooglePlace(false);
    latestAutocompleteReqIdRef.current += 1;
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.EMPTY);
    setHomeFlowState(HOME_FLOW_STATES.DESTINATION_SEARCH);
    snapToExpanded();
  };

  const handleOpenDestinationCategoryPage = (page) => {
    setDestinationCategoryPage(page);
    setDestinationQuery('');
    setDebouncedDestinationQuery('');
    latestAutocompleteReqIdRef.current += 1;
    setGooglePredictions([]);
    setIsGoogleSearching(false);
    setIsResolvingGooglePlace(false);
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.EMPTY);
    snapToExpanded();
  };

  const handleOpenSavedPlaces = () => {
    setHomeFlowState(HOME_FLOW_STATES.SAVED_PLACES);
    snapToExpanded();
  };

  const handleSavedPlacesBack = () => {
    setHomeFlowState(HOME_FLOW_STATES.IDLE);
  };

  const handleOpenRecentDestinations = () => {
    setHomeFlowState(HOME_FLOW_STATES.RECENT_DESTINATIONS);
    snapToExpanded();
  };

  const handleRecentDestinationsBack = () => {
    setHomeFlowState(HOME_FLOW_STATES.IDLE);
  };

  const handleAddAddressPress = () => {
    setShowProfileModal(true);
  };

  // Transition: Idle/Destination Search -> Pickup Selection.
  const handleSavedPlacePress = (place) => {
    if (!ensureSavedPlaceAvailable(place)) {
      return;
    }

    const payload = createDestinationPayload({
      id: `saved-${place.id}`,
      type: 'saved',
      source: 'saved',
      title: place.destination,
      subtitle: place.label,
      coordinate: null,
      tag: 'Saved',
    });

    setSelectedDestination(payload.title);
    setSelectedDestinationDetails(payload);
    setHomeFlowState(HOME_FLOW_STATES.PICKUP_SELECTION);
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.EMPTY);
    setDestinationPreview(null);
    setPinDropCandidate(null);
    setShowMapPoiMarkers(false);
    snapToExpanded();
  };

  const handleRecentDestinationPress = (destination) => {
    const payload = createDestinationPayload({
      id: `recent-${destination.id}`,
      type: 'recent',
      source: 'recent',
      title: destination.title,
      subtitle: destination.subtitle,
      coordinate: destination.coordinate || null,
      tag: 'Recent',
    });

    setSelectedDestination(payload.title);
    setSelectedDestinationDetails(payload);
    setHomeFlowState(HOME_FLOW_STATES.PICKUP_SELECTION);
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.EMPTY);
    setDestinationPreview(null);
    setPinDropCandidate(null);
    setShowMapPoiMarkers(false);

    if (payload.coordinate) {
      centerMapOnLocation(payload.coordinate, 500);
    }

    snapToExpanded();
  };

  const handleBackToIdle = () => {
    setHomeFlowState(HOME_FLOW_STATES.IDLE);
    setDestinationQuery('');
    setDebouncedDestinationQuery('');
    setDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.NONE);
    setSelectedDestination(null);
    setSelectedDestinationDetails(null);
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.EMPTY);
    setDestinationPreview(null);
    setPinDropCandidate(null);
    setShowMapPoiMarkers(false);
    setPlacesSessionToken('');
    setGooglePredictions([]);
    setIsGoogleSearching(false);
    setIsResolvingGooglePlace(false);
    setPickupSearchMode(PICKUP_SEARCH_MODES.DEFAULT);
    setPickupPinCandidate(null);
    setSelectedPickupDetails(null);
    setIsReverseGeocodingPickup(false);
    setPickupQuery('');
    setDebouncedPickupQuery('');
    setPickupGooglePredictions([]);
    setPickupPlacesSessionToken('');
    setIsPickupSearching(false);
    setIsResolvingPickupPlace(false);
    latestAutocompleteReqIdRef.current += 1;
    latestPickupAutocompleteReqIdRef.current += 1;
    pickupReverseReqIdRef.current += 1;
    pickupLastGeocodeAtRef.current = 0;
    pickupLastKeyRef.current = '';
    pickupLastCenterRef.current = null;
    if (pickupReverseTimerRef.current) {
      clearTimeout(pickupReverseTimerRef.current);
      pickupReverseTimerRef.current = null;
    }
    snapToCollapsed();
  };

  const handleDestinationResultPress = async (result) => {
    if (result.type === 'saved') {
      if (!ensureSavedPlaceAvailable(result.data)) {
        return;
      }
    }

    if (result.type === 'google' && result.placeId) {
      setIsResolvingGooglePlace(true);

      try {
        const details = await getPlaceDetails({
          placeId: result.placeId,
          sessionToken: placesSessionToken,
        });

        const detailsLatitude = Number(details?.lat);
        const detailsLongitude = Number(details?.lng);

        const payload = createDestinationPayload({
          id: `google-${details?.placeId || result.placeId}`,
          type: 'poi',
          source: 'google',
          title: details?.name || result.title,
          subtitle: details?.address || result.subtitle || '',
          coordinate:
            Number.isFinite(detailsLatitude) && Number.isFinite(detailsLongitude)
              ? { latitude: detailsLatitude, longitude: detailsLongitude }
              : null,
          tag: 'Google',
        });

        setDestinationPreview(payload);
        setDestinationSearchMode(DESTINATION_SEARCH_MODES.PREVIEW);
        setShowMapPoiMarkers(false);

        if (payload.coordinate) {
          centerMapOnLocation(payload.coordinate, 450);
        }

        setPlacesSessionToken(createPlacesSessionToken());
        snapToExpanded();
      } catch (error) {
        setAlertState({
          visible: true,
          type: 'error',
          title: 'Search error',
          message: error?.message || 'Unable to fetch selected place details.',
        });
      } finally {
        setIsResolvingGooglePlace(false);
      }
      return;
    }

    const payload = createDestinationPayload(result, result.source || 'typed');
    setDestinationPreview(payload);
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.PREVIEW);
    setShowMapPoiMarkers(false);

    if (payload.coordinate) {
      centerMapOnLocation(payload.coordinate, 450);
    }

    snapToExpanded();
  };

  const handleDestinationSearchBack = () => {
    if (destinationSearchMode === DESTINATION_SEARCH_MODES.PREVIEW) {
      setDestinationPreview(null);
      setDestinationSearchMode(
        debouncedDestinationQuery.length > 0
          ? DESTINATION_SEARCH_MODES.RESULTS
          : DESTINATION_SEARCH_MODES.EMPTY
      );
      return;
    }

    if (destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK) {
      setPinDropCandidate(null);
      setDestinationSearchMode(
        debouncedDestinationQuery.length > 0
          ? DESTINATION_SEARCH_MODES.RESULTS
          : DESTINATION_SEARCH_MODES.EMPTY
      );
      snapToExpanded();
      return;
    }

    if (destinationCategoryPage !== DESTINATION_CATEGORY_PAGES.NONE) {
      setDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.NONE);
      return;
    }

    handleBackToIdle();
  };

  const scheduleReverseGeocodeForPinDrop = (centerCoordinate) => {
    const latitude = Number(centerCoordinate?.latitude);
    const longitude = Number(centerCoordinate?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const roundedKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    if (roundedKey === lastReverseGeocodeKeyRef.current) {
      return;
    }

    if (reverseGeocodeTimerRef.current) {
      clearTimeout(reverseGeocodeTimerRef.current);
      reverseGeocodeTimerRef.current = null;
    }

    reverseGeocodeTimerRef.current = setTimeout(async () => {
      reverseGeocodeTimerRef.current = null;

      if (
        homeFlowState !== HOME_FLOW_STATES.DESTINATION_SEARCH ||
        destinationSearchMode !== DESTINATION_SEARCH_MODES.MAP_PICK
      ) {
        return;
      }

      const nextCenter = { lat: latitude, lng: longitude };
      const movedMeters = reverseGeocodeDistanceMeters(lastReverseGeocodeCenterRef.current, nextCenter);
      if (movedMeters < REVERSE_GEOCODE_MIN_MOVE_METERS) {
        return;
      }

      const now = Date.now();
      const lastCallAt = lastReverseGeocodeAtRef.current;
      if (
        lastCallAt > 0 &&
        now - lastCallAt < REVERSE_GEOCODE_COOLDOWN_MS &&
        movedMeters < REVERSE_GEOCODE_FORCE_MOVE_METERS
      ) {
        return;
      }

      const requestId = ++reverseGeocodeReqIdRef.current;
      lastReverseGeocodeKeyRef.current = roundedKey;
      lastReverseGeocodeAtRef.current = now;
      lastReverseGeocodeCenterRef.current = nextCenter;

      try {
        const geocode = await reverseGeocode({ lat: latitude, lng: longitude });
        if (requestId !== reverseGeocodeReqIdRef.current) {
          return;
        }

        const primaryText = String(geocode?.primaryText || '').trim();
        const secondaryText = String(geocode?.secondaryText || '').trim();
        const formattedAddress = String(geocode?.formattedAddress || '').trim();
        const safePrimaryText =
          primaryText && !isPlusCodeLike(primaryText) ? primaryText : '';
        const safeSecondaryText =
          secondaryText && !isPlusCodeLike(secondaryText) ? secondaryText : '';
        const safeFormattedAddress =
          formattedAddress && !isPlusCodeLike(formattedAddress) ? formattedAddress : '';

        if (!safePrimaryText && !safeSecondaryText && !safeFormattedAddress) {
          return;
        }

        setPinDropCandidate((previous) => {
          if (!previous?.coordinate) {
            return previous;
          }

          const previousLatitude = Number(previous.coordinate.latitude);
          const previousLongitude = Number(previous.coordinate.longitude);
          if (!Number.isFinite(previousLatitude) || !Number.isFinite(previousLongitude)) {
            return previous;
          }

          const previousKey = `${previousLatitude.toFixed(5)},${previousLongitude.toFixed(5)}`;
          if (previousKey !== roundedKey) {
            return previous;
          }

          const fallbackCoordinateSubtitle = formatCoordinateSubtitle({
            latitude: previousLatitude,
            longitude: previousLongitude,
          });
          const nextTitle = safePrimaryText || previous.title;
          const nextSubtitle =
            safeSecondaryText || safeFormattedAddress || fallbackCoordinateSubtitle;
          const previousQuality = getMapPickLabelQuality(previous.title, previous.subtitle);
          const nextQuality = getMapPickLabelQuality(nextTitle, nextSubtitle);
          if (nextQuality < previousQuality) {
            return previous;
          }

          if (nextTitle === previous.title && nextSubtitle === previous.subtitle) {
            return previous;
          }

          return {
            ...previous,
            title: nextTitle,
            subtitle: nextSubtitle,
          };
        });
      } catch (error) {
        // Reverse-geocode errors are ignored so map pin flow stays smooth.
      }
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  };

  const handleConfirmDestinationPreview = () => {
    if (!destinationPreview) {
      return;
    }

    setSelectedDestination(destinationPreview.title);
    setSelectedDestinationDetails(destinationPreview);
    setHomeFlowState(HOME_FLOW_STATES.PICKUP_SELECTION);
    setDestinationQuery('');
    setDebouncedDestinationQuery('');
    setDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.NONE);
    setDestinationPreview(null);
    setPinDropCandidate(null);
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.EMPTY);
    setShowMapPoiMarkers(false);
    snapToExpanded();
  };

  const handleSetOnMapPress = () => {
    Keyboard.dismiss();
    setShowMapPoiMarkers(false);
    setDestinationPreview(null);
    setDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.NONE);
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.MAP_PICK);
    if (reverseGeocodeTimerRef.current) {
      clearTimeout(reverseGeocodeTimerRef.current);
      reverseGeocodeTimerRef.current = null;
    }
    reverseGeocodeReqIdRef.current += 1;
    lastReverseGeocodeAtRef.current = 0;
    lastReverseGeocodeKeyRef.current = '';
    lastReverseGeocodeCenterRef.current = null;
    setPinDropCandidate(
      buildPinnedDestination({
        latitude: region.latitude,
        longitude: region.longitude,
      })
    );
    snapToCollapsed();
  };

  const handleConfirmPinnedLocation = () => {
    const candidate =
      pinDropCandidate ||
      buildPinnedDestination({
        latitude: region.latitude,
        longitude: region.longitude,
      });

    if (!candidate) {
      return;
    }

    setDestinationPreview(candidate);
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.PREVIEW);
    setShowMapPoiMarkers(false);
    snapToExpanded();
  };

  const handleToggleMapPoiSearch = () => {
    setShowMapPoiMarkers((prev) => !prev);

    if (destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK) {
      setPinDropCandidate(null);
      setDestinationSearchMode(
        debouncedDestinationQuery.length > 0
          ? DESTINATION_SEARCH_MODES.RESULTS
          : DESTINATION_SEARCH_MODES.EMPTY
      );
      snapToExpanded();
    }
  };

  const handleMapPoiMarkerPress = (poi) => {
    const payload = createDestinationPayload({
      id: poi.id,
      type: 'poi',
      source: 'poi',
      title: poi.title,
      subtitle: poi.subtitle,
      coordinate: poi.coordinate,
      tag: 'POI',
    });

    setDestinationPreview(payload);
    setDestinationSearchMode(DESTINATION_SEARCH_MODES.PREVIEW);
    setShowMapPoiMarkers(true);
    centerMapOnLocation(payload.coordinate, 350);
    snapToExpanded();
  };

  const handleGooglePoiClick = async (event) => {
    if (homeFlowState !== HOME_FLOW_STATES.DESTINATION_SEARCH) {
      return;
    }

    if (destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK) {
      return;
    }

    const nativeEvent = event?.nativeEvent || {};
    const placeId = String(nativeEvent.placeId || '').trim();
    const poiName = String(nativeEvent.name || '').trim();
    const fallbackCoordinate = nativeEvent.coordinate;

    if (!placeId) {
      return;
    }

    const sessionToken = placesSessionToken || createPlacesSessionToken();
    if (!placesSessionToken) {
      setPlacesSessionToken(sessionToken);
    }

    setIsResolvingGooglePlace(true);

    try {
      const details = await getPlaceDetails({
        placeId,
        sessionToken,
      });

      const detailsLatitude = Number(details?.lat);
      const detailsLongitude = Number(details?.lng);
      const payload = createDestinationPayload({
        id: `google-${details?.placeId || placeId}`,
        type: 'poi',
        source: 'google',
        title: details?.name || poiName || 'Selected place',
        subtitle: details?.address || '',
        coordinate:
          Number.isFinite(detailsLatitude) && Number.isFinite(detailsLongitude)
            ? { latitude: detailsLatitude, longitude: detailsLongitude }
            : null,
        tag: 'Google',
      });

      setDestinationPreview(payload);
      setDestinationSearchMode(DESTINATION_SEARCH_MODES.PREVIEW);
      setShowMapPoiMarkers(false);

      if (payload.coordinate) {
        centerMapOnLocation(payload.coordinate, 450);
      }

      snapToExpanded();
      setPlacesSessionToken(createPlacesSessionToken());
    } catch (error) {
      const fallbackLatitude = Number(fallbackCoordinate?.latitude);
      const fallbackLongitude = Number(fallbackCoordinate?.longitude);
      const hasFallbackCoordinate =
        Number.isFinite(fallbackLatitude) && Number.isFinite(fallbackLongitude);

      if (hasFallbackCoordinate) {
        const payload = createDestinationPayload({
          id: `google-fallback-${placeId}`,
          type: 'poi',
          source: 'google',
          title: poiName || 'Selected place',
          subtitle: '',
          coordinate: {
            latitude: fallbackLatitude,
            longitude: fallbackLongitude,
          },
          tag: 'Google',
        });

        setDestinationPreview(payload);
        setDestinationSearchMode(DESTINATION_SEARCH_MODES.PREVIEW);
        setShowMapPoiMarkers(false);
        centerMapOnLocation(payload.coordinate, 450);
        snapToExpanded();
        setPlacesSessionToken(createPlacesSessionToken());
        return;
      }

      setAlertState({
        visible: true,
        type: 'error',
        title: 'Search error',
        message: error?.message || 'Unable to fetch selected place details.',
      });
    } finally {
      setIsResolvingGooglePlace(false);
    }
  };

  const handlePickupSearchResultPress = async (result) => {
    if (!result) {
      return;
    }

    setSelectedPickupDetails(null);
    setPickupSearchMode(PICKUP_SEARCH_MODES.DEFAULT);

    if (result.type === 'google' && result.placeId) {
      const sessionToken = pickupPlacesSessionToken || createPlacesSessionToken();
      if (!pickupPlacesSessionToken) {
        setPickupPlacesSessionToken(sessionToken);
      }

      setIsResolvingPickupPlace(true);
      try {
        const details = await getPlaceDetails({
          placeId: result.placeId,
          sessionToken,
        });

        const latitude = Number(details?.lat);
        const longitude = Number(details?.lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return;
        }

        const candidate = buildPickupCandidate(
          { latitude, longitude },
          {
            id: `pickup-google-${details?.placeId || result.placeId}`,
            title: details?.name || result.title || 'Pinned location',
            subtitle: details?.address || result.subtitle || '',
          }
        );

        if (!candidate) {
          return;
        }

        setPickupPinCandidate(candidate);
        setPickupQuery('');
        setDebouncedPickupQuery('');
        setPickupGooglePredictions([]);
        setPickupPlacesSessionToken(createPlacesSessionToken());
        centerMapOnLocation(candidate.coordinate, 450);
        snapToExpanded();
      } catch (error) {
        setAlertState({
          visible: true,
          type: 'error',
          title: 'Search error',
          message: error?.message || 'Unable to fetch pickup place details.',
        });
      } finally {
        setIsResolvingPickupPlace(false);
      }
      return;
    }

    if (!result.coordinate) {
      return;
    }

    const candidate = buildPickupCandidate(result.coordinate, {
      id: result.id || `pickup-local-${Date.now()}`,
      title: result.title || 'Pinned location',
      subtitle: result.subtitle || formatCoordinateSubtitle(result.coordinate),
    });
    if (!candidate) {
      return;
    }

    setPickupPinCandidate(candidate);
    setPickupQuery('');
    setDebouncedPickupQuery('');
    setPickupGooglePredictions([]);
    centerMapOnLocation(candidate.coordinate, 450);
    snapToExpanded();
  };

  const resolvePickupAddressForCoordinate = async (centerCoordinate, options = {}) => {
    const latitude = Number(centerCoordinate?.latitude);
    const longitude = Number(centerCoordinate?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const force = Boolean(options.force);
    const roundedKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    if (!force && roundedKey === pickupLastKeyRef.current) {
      return;
    }

    const nextCenter = { lat: latitude, lng: longitude };
    const movedMeters = reverseGeocodeDistanceMeters(pickupLastCenterRef.current, nextCenter);
    if (!force && movedMeters < REVERSE_GEOCODE_MIN_MOVE_METERS) {
      return;
    }

    const now = Date.now();
    const lastCallAt = pickupLastGeocodeAtRef.current;
    if (
      !force &&
      lastCallAt > 0 &&
      now - lastCallAt < REVERSE_GEOCODE_COOLDOWN_MS &&
      movedMeters < REVERSE_GEOCODE_FORCE_MOVE_METERS
    ) {
      return;
    }

    const requestId = ++pickupReverseReqIdRef.current;
    pickupLastKeyRef.current = roundedKey;
    pickupLastGeocodeAtRef.current = now;
    pickupLastCenterRef.current = nextCenter;
    setIsReverseGeocodingPickup(true);

    try {
      const geocode = await reverseGeocode({ lat: latitude, lng: longitude });
      if (requestId !== pickupReverseReqIdRef.current) {
        return;
      }

      const primaryText = String(geocode?.primaryText || '').trim();
      const secondaryText = String(geocode?.secondaryText || '').trim();
      const formattedAddress = String(geocode?.formattedAddress || '').trim();
      const safePrimaryText = primaryText && !isPlusCodeLike(primaryText) ? primaryText : '';
      const safeSecondaryText = secondaryText && !isPlusCodeLike(secondaryText) ? secondaryText : '';
      const safeFormattedAddress =
        formattedAddress && !isPlusCodeLike(formattedAddress) ? formattedAddress : '';

      setPickupPinCandidate((previous) => {
        if (!previous?.coordinate) {
          return previous;
        }

        const previousLatitude = Number(previous.coordinate.latitude);
        const previousLongitude = Number(previous.coordinate.longitude);
        if (!Number.isFinite(previousLatitude) || !Number.isFinite(previousLongitude)) {
          return previous;
        }

        const previousKey = `${previousLatitude.toFixed(5)},${previousLongitude.toFixed(5)}`;
        if (previousKey !== roundedKey) {
          return previous;
        }

        const fallbackSubtitle = formatCoordinateSubtitle({
          latitude: previousLatitude,
          longitude: previousLongitude,
        });
        const fallbackTitle =
          previous.title && !isPlusCodeLike(previous.title) ? previous.title : 'Pinned location';
        const nextTitle = safePrimaryText || fallbackTitle;
        const nextSubtitle = safeSecondaryText || safeFormattedAddress || fallbackSubtitle;
        const previousQuality = getMapPickLabelQuality(previous.title, previous.subtitle);
        const nextQuality = getMapPickLabelQuality(nextTitle, nextSubtitle);
        if (nextQuality < previousQuality) {
          return previous;
        }

        if (nextTitle === previous.title && nextSubtitle === previous.subtitle) {
          return previous;
        }

        return {
          ...previous,
          title: nextTitle,
          subtitle: nextSubtitle,
        };
      });
    } catch (error) {
      // Keep current pickup candidate when reverse geocode fails.
    } finally {
      if (requestId === pickupReverseReqIdRef.current) {
        setIsReverseGeocodingPickup(false);
      }
    }
  };

  const schedulePickupReverseGeocode = (centerCoordinate, options = {}) => {
    if (pickupReverseTimerRef.current) {
      clearTimeout(pickupReverseTimerRef.current);
      pickupReverseTimerRef.current = null;
    }

    pickupReverseTimerRef.current = setTimeout(() => {
      pickupReverseTimerRef.current = null;
      resolvePickupAddressForCoordinate(centerCoordinate, options);
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  };

  const handleSetPickupOnMapPress = () => {
    Keyboard.dismiss();
    const mapCenter = {
      latitude: region.latitude,
      longitude: region.longitude,
    };

    setPickupSearchMode(PICKUP_SEARCH_MODES.MAP_PICK);
    setSelectedPickupDetails(null);
    setPickupPinCandidate(buildPickupCandidate(mapCenter));
    schedulePickupReverseGeocode(mapCenter, { force: true });
    snapToCollapsed();
  };

  const handleUseCurrentLocationPickup = () => {
    if (!currentLocation) {
      return;
    }

    if (pickupReverseTimerRef.current) {
      clearTimeout(pickupReverseTimerRef.current);
      pickupReverseTimerRef.current = null;
    }
    pickupReverseReqIdRef.current += 1;
    pickupLastGeocodeAtRef.current = 0;
    pickupLastKeyRef.current = '';
    pickupLastCenterRef.current = null;

    setPickupSearchMode(PICKUP_SEARCH_MODES.DEFAULT);
    setSelectedPickupDetails(null);
    setPickupPinCandidate(
      buildPickupCandidate(currentLocation, {
        title: 'Current location',
        subtitle: 'Finding address...',
      })
    );
    centerMapOnLocation(currentLocation, 450);
    snapToExpanded();
  };

  const handleConfirmPickupPin = () => {
    if (!pickupPinCandidate) {
      return;
    }
    setPickupSearchMode(PICKUP_SEARCH_MODES.PREVIEW);
    snapToExpanded();
  };

  const handleConfirmPickupSelection = () => {
    if (!pickupPinCandidate) {
      return;
    }
    setSelectedPickupDetails(pickupPinCandidate);
    setPickupSearchMode(PICKUP_SEARCH_MODES.DEFAULT);
    setHomeFlowState(HOME_FLOW_STATES.RIDE_OPTIONS);
    snapToExpanded();
  };

  useEffect(() => {
    if (homeFlowState !== HOME_FLOW_STATES.PICKUP_SELECTION) {
      return;
    }
    if (pickupSearchMode !== PICKUP_SEARCH_MODES.DEFAULT) {
      return;
    }
    if (!pickupPinCandidate?.coordinate) {
      return;
    }
    if (selectedPickupDetails) {
      return;
    }
    if (pickupPinCandidate.subtitle !== 'Finding address...') {
      return;
    }

    resolvePickupAddressForCoordinate(pickupPinCandidate.coordinate, { force: true });
  }, [homeFlowState, pickupPinCandidate, pickupSearchMode, selectedPickupDetails]);

  const destinationMarkerCoordinate =
    homeFlowState === HOME_FLOW_STATES.DESTINATION_SEARCH &&
    destinationSearchMode === DESTINATION_SEARCH_MODES.PREVIEW
      ? destinationPreview?.coordinate || null
      : homeFlowState === HOME_FLOW_STATES.PICKUP_SELECTION
        ? selectedDestinationDetails?.coordinate || null
        : null;

  const destinationMarkerTitle =
    homeFlowState === HOME_FLOW_STATES.DESTINATION_SEARCH &&
    destinationSearchMode === DESTINATION_SEARCH_MODES.PREVIEW
      ? destinationPreview?.title || 'Selected destination'
      : selectedDestinationDetails?.title || 'Selected destination';

  const destinationMarkerSubtitle =
    homeFlowState === HOME_FLOW_STATES.DESTINATION_SEARCH &&
    destinationSearchMode === DESTINATION_SEARCH_MODES.PREVIEW
      ? destinationPreview?.subtitle || 'Selected destination'
      : selectedDestinationDetails?.subtitle || 'Selected destination';

  const pickupMarkerCoordinate =
    homeFlowState === HOME_FLOW_STATES.PICKUP_SELECTION &&
    pickupSearchMode !== PICKUP_SEARCH_MODES.MAP_PICK
      ? selectedPickupDetails?.coordinate || pickupPinCandidate?.coordinate || null
      : null;
  const shouldShowPickupDestinationPolyline =
    homeFlowState === HOME_FLOW_STATES.PICKUP_SELECTION &&
    pickupSearchMode !== PICKUP_SEARCH_MODES.MAP_PICK &&
    Boolean(pickupMarkerCoordinate) &&
    Boolean(destinationMarkerCoordinate);

  const pickupMarkerTitle =
    selectedPickupDetails?.title || pickupPinCandidate?.title || 'Pickup location';
  const pickupMarkerSubtitle =
    selectedPickupDetails?.subtitle ||
    pickupPinCandidate?.subtitle ||
    'Selected pickup location';
  const isDestinationCategoryPageOpen =
    destinationCategoryPage !== DESTINATION_CATEGORY_PAGES.NONE;
  const destinationSearchHeaderTitle =
    destinationCategoryPage === DESTINATION_CATEGORY_PAGES.SAVED
      ? 'Saved places'
      : destinationCategoryPage === DESTINATION_CATEGORY_PAGES.RECENT
        ? 'Recent destinations'
        : destinationCategoryPage === DESTINATION_CATEGORY_PAGES.POPULAR
          ? 'Popular destinations'
          : 'Choose destination';

  return (
    <View style={styles.container}>
      {/* Full-screen map layer. */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onRegionChangeComplete={(nextRegion) => {
          setRegion(nextRegion);
          if (
            homeFlowState === HOME_FLOW_STATES.DESTINATION_SEARCH &&
            destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK
          ) {
            const mapPickCenter = {
              latitude: nextRegion.latitude,
              longitude: nextRegion.longitude,
            };
            setPinDropCandidate(
              buildPinnedDestination(mapPickCenter)
            );
            scheduleReverseGeocodeForPinDrop(mapPickCenter);
          }
          if (
            homeFlowState === HOME_FLOW_STATES.PICKUP_SELECTION &&
            pickupSearchMode === PICKUP_SEARCH_MODES.MAP_PICK
          ) {
            const pickupCenter = {
              latitude: nextRegion.latitude,
              longitude: nextRegion.longitude,
            };
            setPickupPinCandidate(buildPickupCandidate(pickupCenter));
            schedulePickupReverseGeocode(pickupCenter);
          }
        }}
        onPoiClick={handleGooglePoiClick}
      >
        {/* User location ring + marker, animated for smoother visual updates. */}
        {animatedLocation && (
          <>
            <Circle
              center={{
                latitude: animatedLocation.latitude,
                longitude: animatedLocation.longitude,
              }}
              radius={animatedLocation.radius}
              strokeWidth={1.5}
              strokeColor="rgba(24, 140, 120, 0.35)"
              fillColor="rgba(24, 140, 120, 0.16)"
            />
            <Marker
              coordinate={{
                latitude: animatedLocation.latitude,
                longitude: animatedLocation.longitude,
              }}
              title="You are here"
              pinColor="#DC3545"
            />
          </>
        )}

        {destinationMarkerCoordinate && (
          <>
            <Circle
              center={destinationMarkerCoordinate}
              radius={70}
              strokeWidth={1.5}
              strokeColor={`${COLORS.teal}66`}
              fillColor={`${COLORS.teal}1A`}
            />
            <Marker
              coordinate={destinationMarkerCoordinate}
              title={destinationMarkerTitle}
              description={destinationMarkerSubtitle}
              pinColor={COLORS.teal}
            />
          </>
        )}

        {pickupMarkerCoordinate && (
          <Marker
            coordinate={pickupMarkerCoordinate}
            title={pickupMarkerTitle}
            description={pickupMarkerSubtitle}
            pinColor={COLORS.secondary}
          />
        )}

        {shouldShowPickupDestinationPolyline && (
          <Polyline
            coordinates={[pickupMarkerCoordinate, destinationMarkerCoordinate]}
            strokeColor={COLORS.teal}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {shouldShowRideRoutePreview && pickupToDestinationRoutePath.length > 1 && (
          <Polyline
            coordinates={pickupToDestinationRoutePath}
            strokeColor={`${COLORS.teal}70`}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {shouldShowRideRoutePreview && pickupAnimationStartCoordinate && (
          <>
            <Circle
              center={pickupAnimationStartCoordinate}
              radius={70}
              strokeWidth={1.5}
              strokeColor={`${COLORS.secondary}66`}
              fillColor={`${COLORS.secondary}1F`}
            />
            <Marker
              coordinate={pickupAnimationStartCoordinate}
              title={selectedPickupDetails?.title || pickupPinCandidate?.title || 'Pickup location'}
              description={
                selectedPickupDetails?.subtitle ||
                pickupPinCandidate?.subtitle ||
                'Selected pickup location'
              }
              pinColor={COLORS.secondary}
            />
          </>
        )}

        {shouldShowRideRoutePreview && selectedDestinationDetails?.coordinate && (
          <>
            <Circle
              center={selectedDestinationDetails.coordinate}
              radius={70}
              strokeWidth={1.5}
              strokeColor={`${COLORS.teal}66`}
              fillColor={`${COLORS.teal}1A`}
            />
            <Marker
              coordinate={selectedDestinationDetails.coordinate}
              title={selectedDestinationDetails.title}
              description={selectedDestinationDetails.subtitle || 'Selected destination'}
              pinColor={COLORS.teal}
            />
          </>
        )}

      </MapView>

      {((homeFlowState === HOME_FLOW_STATES.DESTINATION_SEARCH &&
        destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK) ||
        (homeFlowState === HOME_FLOW_STATES.PICKUP_SELECTION &&
          pickupSearchMode === PICKUP_SEARCH_MODES.MAP_PICK)) && (
          <View
            pointerEvents="none"
            style={[
              styles.pinDropOverlay,
              { paddingBottom: collapsedPanelHeight * 0.6 },
            ]}
          >
            <MaterialIcons name="place" size={44} color={COLORS.teal} />
            <View style={styles.pinDropTip} />
          </View>
        )}

      {/* Floating map controls (recenter + north reset). */}
      <View
        style={[
          styles.mapControlsContainer,
          {
            right: mapControlsRight,
            bottom: mapControlsBottom,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.mapControlButton,
            { width: mapControlButtonSize, height: mapControlButtonSize, borderRadius: mapControlButtonSize / 2 },
          ]}
          disabled={recentering}
          onPress={handleRecenter}
        >
          {recentering ? (
            <ActivityIndicator size="small" color={COLORS.teal} />
          ) : (
            <MaterialIcons name="my-location" size={20} color={COLORS.teal} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.mapControlButton,
            { width: mapControlButtonSize, height: mapControlButtonSize, borderRadius: mapControlButtonSize / 2 },
          ]}
          onPress={handleResetCompass}
        >
          <MaterialIcons name="explore" size={20} color={COLORS.teal} />
        </TouchableOpacity>
      </View>

      {/* Top app actions. */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={[styles.header, { paddingTop: headerTop, paddingHorizontal: headerHorizontal }]}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
            ]}
            onPress={() => setShowMenu(true)}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerButton,
              { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
            ]}
            onPress={() =>
              setAlertState({
                visible: true,
                type: 'info',
                title: 'Notifications',
                message: 'No new notifications.',
              })
            }
          >
            <MaterialIcons name="notifications" size={22} color={COLORS.teal} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Snap panel rebuilt from current static layout. */}
      <Animated.View
        style={[
          styles.bottomPanel,
          {
            height: panelHeightAnim,
            borderTopLeftRadius: panelRadius,
            borderTopRightRadius: panelRadius,
          },
        ]}
      >
        <View
          style={[
            styles.panelHandleTouch,
            {
              paddingTop: 12,
              paddingBottom: 10,
            },
          ]}
          {...panelPanResponder.panHandlers}
        >
          <TouchableOpacity activeOpacity={0.85} onPress={togglePanelSnap} style={styles.panelHandleButton}>
            <View style={styles.panelHandle} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={[
            styles.panelScrollContent,
            {
              paddingHorizontal: panelPadding,
              paddingBottom: Math.max(insets.bottom + 16, 18),
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {homeFlowState === HOME_FLOW_STATES.IDLE && (
            <>
              <View style={styles.panelHeaderRow}>
                <View style={styles.panelHeaderTitleWrap}>
                  <Text style={styles.panelTitleLarge}>Where are you going?</Text>
                </View>
                <TouchableOpacity
                  style={styles.paymentChip}
                  onPress={() => setPaymentMethod((prev) => (prev === 'Cash' ? 'Wallet' : 'Cash'))}
                >
                  <Text style={styles.paymentChipText}>{paymentMethod}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.whereToButton} onPress={handleDestinationPress}>
                <View style={styles.searchCardLeadingIcon}>
                  <MaterialIcons name="search" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.whereToTextWrap}>
                  <Text style={styles.whereToPrompt}>Search destination</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={COLORS.textLight} />
              </TouchableOpacity>

              <View style={styles.savedPlacesColumn}>
                <TouchableOpacity style={styles.savedPlaceButton} onPress={handleOpenSavedPlaces}>
                  <View style={styles.resultRowLeft}>
                    <View style={styles.rowIconCircle}>
                      <MaterialIcons name="bookmark-border" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.savedPlaceLabel}>Saved places</Text>
                      <Text style={styles.savedPlaceSubtitle}>Home and work addresses</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>

              <View style={styles.savedPlacesColumn}>
                <TouchableOpacity style={styles.savedPlaceButton} onPress={handleOpenRecentDestinations}>
                  <View style={styles.resultRowLeft}>
                    <View style={styles.rowIconCircle}>
                      <MaterialIcons name="history" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.savedPlaceLabel}>Recent destinations</Text>
                      <Text style={styles.savedPlaceSubtitle}>View your recent trips</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {homeFlowState === HOME_FLOW_STATES.SAVED_PLACES && (
            <>
              <View style={styles.panelHeaderRowCentered}>
                <TouchableOpacity style={styles.smallBackButton} onPress={handleSavedPlacesBack}>
                  <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.panelTitle}>Saved places</Text>
                <View style={styles.panelHeaderSpacer} />
              </View>

              <Text style={styles.sectionTitle}>Home and work</Text>
              <View style={styles.savedPlacesColumn}>
                {savedPlaces.map((place) => {
                  const isHomePlace = place.id === 'home';
                  const hasAddress = isHomePlace ? hasHomeAddressSaved : hasWorkAddressSaved;
                  if (!hasAddress) {
                    return null;
                  }

                  return (
                    <TouchableOpacity
                      key={`saved-page-${place.id}`}
                      style={styles.savedPlaceButton}
                      onPress={() => handleSavedPlacePress(place)}
                    >
                      <View style={styles.resultRowLeft}>
                        <View style={styles.rowIconCircle}>
                          <MaterialIcons
                            name={isHomePlace ? 'home' : 'work'}
                            size={18}
                            color={COLORS.primary}
                          />
                        </View>
                        <View style={styles.rowTextWrap}>
                          <Text style={styles.savedPlaceLabel}>{place.label}</Text>
                          <Text style={styles.savedPlaceSubtitle}>{place.destination}</Text>
                        </View>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!hasHomeAddressSaved && (
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.savedPlacesAddAddressButton]}
                  onPress={handleAddAddressPress}
                >
                  <MaterialIcons name="home" size={16} color={COLORS.secondary} />
                  <Text style={[styles.quickActionText, styles.outlineAccentChipText]}>
                    Add home address
                  </Text>
                </TouchableOpacity>
              )}

              {!hasWorkAddressSaved && (
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.savedPlacesAddAddressButton]}
                  onPress={handleAddAddressPress}
                >
                  <MaterialIcons name="work-outline" size={16} color={COLORS.secondary} />
                  <Text style={[styles.quickActionText, styles.outlineAccentChipText]}>
                    Add work address
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {homeFlowState === HOME_FLOW_STATES.RECENT_DESTINATIONS && (
            <>
              <View style={styles.panelHeaderRowCentered}>
                <TouchableOpacity style={styles.smallBackButton} onPress={handleRecentDestinationsBack}>
                  <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.panelTitle}>Recent destinations</Text>
                <View style={styles.panelHeaderSpacer} />
              </View>

              {RECENT_DESTINATIONS.map((destination) => (
                <TouchableOpacity
                  key={`idle-recent-${destination.id}`}
                  style={styles.recentItem}
                  onPress={() => handleRecentDestinationPress(destination)}
                >
                  <View style={styles.resultRowLeft}>
                    <View style={styles.rowIconCircle}>
                      <MaterialIcons name="history" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.recentItemTitle}>{destination.title}</Text>
                      <Text style={styles.recentItemSubtitle}>{destination.subtitle}</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              ))}
            </>
          )}

          {homeFlowState === HOME_FLOW_STATES.DESTINATION_SEARCH && (
            <>
              <View style={styles.panelHeaderRowCentered}>
                <TouchableOpacity style={styles.smallBackButton} onPress={handleDestinationSearchBack}>
                  <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.panelTitle}>{destinationSearchHeaderTitle}</Text>
                {isDestinationCategoryPageOpen ? (
                  <View style={styles.panelHeaderSpacer} />
                ) : (
                  <TouchableOpacity
                    style={styles.headerClearButton}
                    onPress={() => {
                      setDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.NONE);
                      setDestinationQuery('');
                      if (destinationSearchMode === DESTINATION_SEARCH_MODES.PREVIEW) {
                        setDestinationPreview(null);
                      }
                      if (destinationSearchMode !== DESTINATION_SEARCH_MODES.MAP_PICK) {
                        setDestinationSearchMode(DESTINATION_SEARCH_MODES.EMPTY);
                      }
                    }}
                  >
                    <Text style={styles.headerClearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.searchInputLike}>
                <MaterialIcons name="search" size={18} color={COLORS.textSecondary} style={styles.searchInputIcon} />
                <TextInput
                  value={destinationQuery}
                  onChangeText={(value) => {
                    setDestinationQuery(value);
                    if (
                      destinationCategoryPage !== DESTINATION_CATEGORY_PAGES.NONE &&
                      value.trim().length > 0
                    ) {
                      setDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.NONE);
                    }
                    if (destinationSearchMode === DESTINATION_SEARCH_MODES.PREVIEW) {
                      setDestinationPreview(null);
                      setDestinationSearchMode(
                        value.trim().length > 0
                          ? DESTINATION_SEARCH_MODES.RESULTS
                          : DESTINATION_SEARCH_MODES.EMPTY
                      );
                    }
                  }}
                  placeholder="Type destination or POI"
                  placeholderTextColor={COLORS.textSecondary}
                  style={styles.searchInputField}
                  autoFocus={destinationSearchMode !== DESTINATION_SEARCH_MODES.MAP_PICK}
                  returnKeyType="search"
                  editable={destinationSearchMode !== DESTINATION_SEARCH_MODES.MAP_PICK}
                />
                {destinationQuery.trim().length > 0 && (
                  <TouchableOpacity
                    style={styles.searchClearButton}
                    onPress={() => setDestinationQuery('')}
                  >
                    <MaterialIcons name="close" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.searchInputHint}>Suggestions update as you type</Text>

              <View style={styles.searchActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.quickActionButton,
                    styles.searchActionButton,
                    destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK &&
                      styles.searchActionButtonActive,
                  ]}
                  onPress={handleSetOnMapPress}
                >
                  <MaterialIcons
                    name="map"
                    size={16}
                    color={
                      destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK
                        ? COLORS.white
                        : COLORS.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.quickActionText,
                      styles.outlineAccentChipText,
                      destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK &&
                        styles.searchActionTextActive,
                    ]}
                  >
                    Set destination on map
                  </Text>
                </TouchableOpacity>
              </View>

              {destinationSearchMode === DESTINATION_SEARCH_MODES.MAP_PICK ? (
                <View style={styles.stateCard}>
                  <Text style={styles.stateCardTitle}>Set destination on map</Text>
                  <Text style={styles.stateCardHint}>
                    Move the map until the pin points to your destination.
                  </Text>
                  <Text style={styles.mapPinCandidateTitle}>
                    {pinDropCandidate?.title || 'Pinned location'}
                  </Text>
                  <Text style={styles.mapPinCandidateSubtitle}>
                    {pinDropCandidate?.subtitle ||
                      formatCoordinateSubtitle({
                        latitude: region.latitude,
                        longitude: region.longitude,
                      })}
                  </Text>

                  <TouchableOpacity
                    style={[styles.previewPrimaryButton, styles.previewButtonSingle]}
                    onPress={handleConfirmPinnedLocation}
                  >
                    <Text style={styles.previewPrimaryButtonText}>Confirm destination</Text>
                  </TouchableOpacity>
                </View>
              ) : destinationSearchMode === DESTINATION_SEARCH_MODES.PREVIEW ? (
                <View style={styles.stateCard}>
                  <Text style={styles.stateCardTitle}>Destination preview</Text>
                  <Text style={styles.stateCardValue}>{destinationPreview?.title || '-'}</Text>
                  <Text style={styles.stateCardHint}>
                    {destinationPreview?.subtitle || 'Confirm destination to continue.'}
                  </Text>

                  <View style={styles.previewActionsRow}>
                    <TouchableOpacity
                      style={styles.previewSecondaryButton}
                      onPress={() => {
                        setDestinationPreview(null);
                        setDestinationSearchMode(
                          debouncedDestinationQuery.length > 0
                            ? DESTINATION_SEARCH_MODES.RESULTS
                            : DESTINATION_SEARCH_MODES.EMPTY
                        );
                      }}
                    >
                      <Text style={styles.previewSecondaryButtonText}>Change</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.previewPrimaryButton}
                      onPress={handleConfirmDestinationPreview}
                    >
                      <Text style={styles.previewPrimaryButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : destinationQuery.trim().length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Search results</Text>
                  {(isGoogleSearching || isResolvingGooglePlace) && (
                    <View style={styles.searchLoadingRow}>
                      <ActivityIndicator size="small" color={COLORS.teal} />
                      <Text style={styles.searchLoadingText}>
                        {isResolvingGooglePlace
                          ? 'Fetching place details...'
                          : 'Searching places...'}
                      </Text>
                    </View>
                  )}
                  {destinationSearchResults.length > 0 ? (
                    destinationSearchResults.map((result) => (
                      <TouchableOpacity
                        key={result.id}
                        style={styles.recentItem}
                        onPress={() => handleDestinationResultPress(result)}
                      >
                        <View style={styles.resultRowLeft}>
                          <View style={styles.rowIconCircle}>
                            <MaterialIcons
                              name={getLocationRowIconName(result)}
                              size={18}
                              color={COLORS.primary}
                            />
                          </View>
                          <View style={styles.rowTextWrap}>
                            <Text style={styles.recentItemTitle}>{result.title}</Text>
                            <Text style={styles.recentItemSubtitle}>{result.subtitle}</Text>
                          </View>
                        </View>
                        <View style={styles.resultTagPill}>
                          <Text style={styles.searchResultTag}>{result.tag}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    !isGoogleSearching &&
                    !isResolvingGooglePlace && (
                      <View style={styles.searchEmptyState}>
                        <Text style={styles.searchEmptyText}>
                          No destination found. Try another search term.
                        </Text>
                      </View>
                    )
                  )}
                </>
              ) : (
                <>
                  {isDestinationCategoryPageOpen ? (
                    <>
                      {destinationCategoryPage === DESTINATION_CATEGORY_PAGES.SAVED && (
                        <>
                          <View style={styles.savedPlacesColumn}>
                            {savedPlaces.map((place) => (
                              <TouchableOpacity
                                key={`search-saved-${place.id}`}
                                style={styles.savedPlaceButton}
                                onPress={() =>
                                  handleDestinationResultPress({
                                    id: `saved-${place.id}`,
                                    type: 'saved',
                                    source: 'saved',
                                    title: place.destination,
                                    subtitle: place.label,
                                    tag: 'Saved',
                                    coordinate: null,
                                    data: place,
                                  })
                                }
                              >
                                <View style={styles.resultRowLeft}>
                                  <View style={styles.rowIconCircle}>
                                    <MaterialIcons
                                      name={place.id === 'work' ? 'work' : 'home'}
                                      size={18}
                                      color={COLORS.primary}
                                    />
                                  </View>
                                  <View style={styles.rowTextWrap}>
                                    <Text style={styles.savedPlaceLabel}>{place.label}</Text>
                                    <Text style={styles.savedPlaceSubtitle}>{place.destination}</Text>
                                  </View>
                                </View>
                                <View style={styles.resultTagPill}>
                                  <Text style={styles.searchResultTag}>Saved</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      {destinationCategoryPage === DESTINATION_CATEGORY_PAGES.RECENT && (
                        <>
                          {RECENT_DESTINATIONS.map((destination) => (
                            <TouchableOpacity
                              key={`search-recent-${destination.id}`}
                              style={styles.recentItem}
                              onPress={() =>
                                handleDestinationResultPress({
                                  id: `recent-${destination.id}`,
                                  type: 'recent',
                                  source: 'recent',
                                  title: destination.title,
                                  subtitle: destination.subtitle,
                                  tag: 'Recent',
                                  coordinate: destination.coordinate,
                                  data: destination,
                                })
                              }
                            >
                              <View style={styles.resultRowLeft}>
                                <View style={styles.rowIconCircle}>
                                  <MaterialIcons name="history" size={18} color={COLORS.primary} />
                                </View>
                                <View style={styles.rowTextWrap}>
                                  <Text style={styles.recentItemTitle}>{destination.title}</Text>
                                  <Text style={styles.recentItemSubtitle}>{destination.subtitle}</Text>
                                </View>
                              </View>
                              <View style={styles.resultTagPill}>
                                <Text style={styles.searchResultTag}>Recent</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}

                      {destinationCategoryPage === DESTINATION_CATEGORY_PAGES.POPULAR && (
                        <>
                          {DESTINATION_POIS.map((destination) => (
                            <TouchableOpacity
                              key={`dest-poi-${destination.id}`}
                              style={styles.recentItem}
                              onPress={() =>
                                handleDestinationResultPress({
                                  id: destination.id,
                                  type: 'poi',
                                  source: 'poi',
                                  title: destination.title,
                                  subtitle: destination.subtitle,
                                  coordinate: destination.coordinate,
                                  tag: 'POI',
                                  data: destination,
                                })
                              }
                            >
                              <View style={styles.resultRowLeft}>
                                <View style={styles.rowIconCircle}>
                                  <MaterialIcons name="place" size={18} color={COLORS.primary} />
                                </View>
                                <View style={styles.rowTextWrap}>
                                  <Text style={styles.recentItemTitle}>{destination.title}</Text>
                                  <Text style={styles.recentItemSubtitle}>{destination.subtitle}</Text>
                                </View>
                              </View>
                              <View style={styles.resultTagPill}>
                                <Text style={styles.searchResultTag}>POI</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={styles.savedPlacesColumn}>
                        <TouchableOpacity
                          style={styles.savedPlaceButton}
                          onPress={() =>
                            handleOpenDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.SAVED)
                          }
                        >
                          <View style={styles.resultRowLeft}>
                            <View style={styles.rowIconCircle}>
                              <MaterialIcons name="bookmark-border" size={18} color={COLORS.primary} />
                            </View>
                            <View style={styles.rowTextWrap}>
                              <Text style={styles.savedPlaceLabel}>Saved places</Text>
                              <Text style={styles.savedPlaceSubtitle}>Home and work addresses</Text>
                            </View>
                          </View>
                          <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.savedPlacesColumn}>
                        <TouchableOpacity
                          style={styles.savedPlaceButton}
                          onPress={() =>
                            handleOpenDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.RECENT)
                          }
                        >
                          <View style={styles.resultRowLeft}>
                            <View style={styles.rowIconCircle}>
                              <MaterialIcons name="history" size={18} color={COLORS.primary} />
                            </View>
                            <View style={styles.rowTextWrap}>
                              <Text style={styles.savedPlaceLabel}>Recent destinations</Text>
                              <Text style={styles.savedPlaceSubtitle}>View your recent trips</Text>
                            </View>
                          </View>
                          <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.savedPlacesColumn}>
                        <TouchableOpacity
                          style={styles.savedPlaceButton}
                          onPress={() =>
                            handleOpenDestinationCategoryPage(DESTINATION_CATEGORY_PAGES.POPULAR)
                          }
                        >
                          <View style={styles.resultRowLeft}>
                            <View style={styles.rowIconCircle}>
                              <MaterialIcons name="place" size={18} color={COLORS.primary} />
                            </View>
                            <View style={styles.rowTextWrap}>
                              <Text style={styles.savedPlaceLabel}>Popular destinations</Text>
                              <Text style={styles.savedPlaceSubtitle}>Frequently visited places</Text>
                            </View>
                          </View>
                          <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {homeFlowState === HOME_FLOW_STATES.PICKUP_SELECTION && (
            <>
              <View style={styles.panelHeaderRowCentered}>
                <TouchableOpacity
                  style={styles.smallBackButton}
                  onPress={() => {
                    setHomeFlowState(HOME_FLOW_STATES.DESTINATION_SEARCH);
                    setDestinationSearchMode(
                      debouncedDestinationQuery.length > 0
                        ? DESTINATION_SEARCH_MODES.RESULTS
                        : DESTINATION_SEARCH_MODES.EMPTY
                    );
                  }}
                >
                  <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.panelTitle}>Confirm pickup</Text>
                <View style={styles.panelHeaderSpacer} />
              </View>

              <Text style={styles.pickupDestinationSubline}>
                Destination set:{' '}
                {selectedDestinationDetails?.title || selectedDestination || '-'}
              </Text>

              <View style={styles.stateCard}>
                <View style={styles.pickupCardTitleRow}>
                  <Text style={styles.stateCardTitle}>Destination selected</Text>
                  {(selectedDestinationDetails?.title || selectedDestination) ? (
                    <View style={styles.pickupBadge}>
                      <Text style={styles.pickupBadgeText}>Selected</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.stateCardValue}>
                  {selectedDestinationDetails?.title || selectedDestination || '-'}
                </Text>
                <Text style={styles.stateCardHint}>
                  {selectedDestinationDetails?.subtitle || 'Pickup selection / route preview is the next step.'}
                </Text>
              </View>

              <View style={[styles.stateCard, styles.pickupSummaryCard]}>
                <View style={styles.pickupCardTitleRow}>
                  <Text style={styles.stateCardTitle}>Pickup location</Text>
                  {selectedPickupDetails ? (
                    <View style={styles.pickupBadge}>
                      <Text style={styles.pickupBadgeText}>Selected</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.stateCardValue}>
                  {selectedPickupDetails?.title || pickupPinCandidate?.title || 'Not selected yet'}
                </Text>
                <Text style={styles.stateCardHint}>
                  {selectedPickupDetails?.subtitle ||
                    pickupPinCandidate?.subtitle ||
                    'Use current location or set pickup on map.'}
                </Text>
              </View>

              {isReverseGeocodingPickup && (
                <View style={styles.searchLoadingRow}>
                  <ActivityIndicator size="small" color={COLORS.teal} />
                  <Text style={styles.searchLoadingText}>Updating pickup address...</Text>
                </View>
              )}

              {pickupSearchMode === PICKUP_SEARCH_MODES.MAP_PICK ? (
                <View style={styles.stateCard}>
                  <Text style={styles.stateCardTitle}>Set pickup on map</Text>
                  <Text style={styles.stateCardHint}>
                    Move the map until the pin points to your pickup spot.
                  </Text>
                  {pickupPinCandidate?.title ? (
                    <Text style={styles.mapPinCandidateTitle}>{pickupPinCandidate.title}</Text>
                  ) : null}
                  {pickupPinCandidate?.subtitle ? (
                    <Text style={styles.mapPinCandidateSubtitle}>{pickupPinCandidate.subtitle}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.previewPrimaryButton,
                      styles.previewButtonSingle,
                      !pickupPinCandidate && styles.previewPrimaryButtonDisabled,
                    ]}
                    onPress={handleConfirmPickupPin}
                    disabled={!pickupPinCandidate}
                  >
                    <Text style={styles.previewPrimaryButtonText}>Confirm pickup pin</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.searchInputLike}>
                    <MaterialIcons
                      name="search"
                      size={18}
                      color={COLORS.textSecondary}
                      style={styles.searchInputIcon}
                    />
                    <TextInput
                      style={styles.searchInputField}
                      value={pickupQuery}
                      onChangeText={setPickupQuery}
                      placeholder="Type pickup location"
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                    />
                    {pickupQuery.trim().length > 0 && (
                      <TouchableOpacity
                        style={styles.searchClearButton}
                        onPress={() => setPickupQuery('')}
                      >
                        <MaterialIcons name="close" size={18} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.searchInputHint}>Search pickup address or place</Text>

                  {(isPickupSearching || isResolvingPickupPlace) && (
                    <View style={styles.searchLoadingRow}>
                      <ActivityIndicator size="small" color={COLORS.teal} />
                      <Text style={styles.searchLoadingText}>
                        {isResolvingPickupPlace ? 'Fetching pickup details...' : 'Searching pickup...'}
                      </Text>
                    </View>
                  )}

                  {pickupQuery.trim().length > 0 && (
                    <>
                      {pickupSearchResults.length > 0 ? (
                        pickupSearchResults.map((result) => (
                          <TouchableOpacity
                            key={result.id}
                            style={styles.recentItem}
                            onPress={() => handlePickupSearchResultPress(result)}
                          >
                            <View style={styles.resultRowLeft}>
                              <View style={styles.rowIconCircle}>
                                <MaterialIcons
                                  name={getLocationRowIconName(result)}
                                  size={18}
                                  color={COLORS.primary}
                                />
                              </View>
                              <View style={styles.rowTextWrap}>
                                <Text style={styles.recentItemTitle}>{result.title}</Text>
                                <Text style={styles.recentItemSubtitle}>{result.subtitle}</Text>
                              </View>
                            </View>
                            <View style={styles.resultTagPill}>
                              <Text style={styles.searchResultTag}>{result.tag}</Text>
                            </View>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={styles.searchEmptyState}>
                          <Text style={styles.searchEmptyText}>
                            No pickup location found. Try another search term.
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  <View style={styles.searchActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.quickActionButton,
                        styles.searchActionButton,
                        styles.searchActionButtonSpacing,
                      ]}
                      onPress={handleSetPickupOnMapPress}
                    >
                      <MaterialIcons name="map" size={16} color={COLORS.secondary} />
                      <Text style={[styles.quickActionText, styles.outlineAccentChipText]}>
                        Set on map
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quickActionButton, styles.searchActionButton]}
                      onPress={handleUseCurrentLocationPickup}
                    >
                      <MaterialIcons name="my-location" size={16} color={COLORS.secondary} />
                      <Text style={[styles.quickActionText, styles.outlineAccentChipText]}>
                        Current location
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {pickupPinCandidate && (
                    <View style={styles.pickupWarningCard}>
                      <MaterialIcons name="warning-amber" size={16} color={COLORS.warning} />
                      <Text style={styles.pickupWarningText}>
                        Pickup may be unsafe here. Move to a nearby spot for a smoother experience.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.previewPrimaryButton,
                      styles.previewButtonSingle,
                      !pickupPinCandidate && styles.previewPrimaryButtonDisabled,
                    ]}
                    onPress={handleConfirmPickupSelection}
                    disabled={!pickupPinCandidate}
                  >
                    <Text style={styles.previewPrimaryButtonText}>Confirm pickup</Text>
                  </TouchableOpacity>
                </>
              )}

              {selectedPickupDetails && (
                <View style={[styles.stateCard, styles.pickupSummaryCard]}>
                  <Text style={styles.stateCardTitle}>Next step</Text>
                  <Text style={styles.stateCardHint}>
                    Pickup confirmed. Next: ride options / route preview.
                  </Text>
                </View>
              )}
            </>
          )}

          {homeFlowState === HOME_FLOW_STATES.RIDE_OPTIONS && (
            <>
              <View style={styles.panelHeaderRowCentered}>
                <TouchableOpacity
                  style={styles.smallBackButton}
                  onPress={() => {
                    setHomeFlowState(HOME_FLOW_STATES.PICKUP_SELECTION);
                    setPickupSearchMode(PICKUP_SEARCH_MODES.DEFAULT);
                    snapToExpanded();
                  }}
                >
                  <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.panelTitle}>Ride options</Text>
                <View style={styles.panelHeaderSpacer} />
              </View>

              <View style={styles.routePreviewCard}>
                <Text style={styles.stateCardTitle}>Route preview</Text>
                <View style={styles.routePreviewRow}>
                  <View style={styles.routePreviewTrackColumn}>
                    <View style={[styles.routeDot, styles.routeDotPickup]} />
                    <View style={styles.routeConnectorWrap}>
                      <View style={styles.routeConnectorLine} />
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.routeConnectorPulse,
                          {
                            transform: [{ translateY: routePreviewPulseTranslateY }],
                            opacity: routePreviewPulseOpacity,
                          },
                        ]}
                      />
                    </View>
                    <View style={[styles.routeDot, styles.routeDotDestination]} />
                  </View>

                  <View style={styles.routeStopsColumn}>
                    <View style={styles.routeStopBlock}>
                      <Text style={styles.routeStopLabel}>Pickup</Text>
                      <Text style={styles.routeStopTitle}>
                        {selectedPickupDetails?.title || 'Pickup location'}
                      </Text>
                      {selectedPickupDetails?.subtitle ? (
                        <Text style={styles.routeStopSubtitle}>{selectedPickupDetails.subtitle}</Text>
                      ) : null}
                    </View>

                    <View style={styles.routeStopsSpacer} />

                    <View style={styles.routeStopBlock}>
                      <Text style={styles.routeStopLabel}>Destination</Text>
                      <Text style={styles.routeStopTitle}>
                        {selectedDestinationDetails?.title || selectedDestination || 'Destination'}
                      </Text>
                      {selectedDestinationDetails?.subtitle ? (
                        <Text style={styles.routeStopSubtitle}>
                          {selectedDestinationDetails.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>

              {fareError ? <Text style={styles.rideOptionFareError}>{fareError}</Text> : null}

              {RIDE_OPTIONS.map((rideOption) => (
                <View key={rideOption.id} style={styles.rideOptionCard}>
                  <View style={styles.rideOptionImageWrap}>
                    <Image
                      source={rideOption.image}
                      style={styles.rideOptionImage}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={styles.rideOptionTextWrap}>
                    <Text style={styles.rideOptionTitle}>{rideOption.title}</Text>
                    <Text style={styles.rideOptionMeta}>{getRideOptionMetaText(rideOption)}</Text>
                  </View>
                  <View style={styles.rideOptionFareWrap}>
                    <Text style={styles.rideOptionFareText}>
                      {fareLoading
                        ? '...'
                        : fareByOptionId?.[rideOption.id]?.formatted || '--'}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Slide-in side menu. */}
      <Modal visible={showMenu} animationType="slide" transparent={true} onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View
            style={[
              styles.sideMenu,
              {
                width: sideMenuWidth,
                paddingTop: menuPaddingTop,
                paddingBottom: Math.max(insets.bottom + 18, 22),
              },
            ]}
          >
            <View style={styles.sideMenuTop}>
              <View style={styles.menuProfileRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handlePickAvatar}
                  disabled={isUploadingAvatar || isPickingAvatar}
                  style={{ marginRight: avatarMargin }}
                >
                  <View
                    style={[
                      styles.profileAvatar,
                      {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                      },
                    ]}
                  >
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.profileAvatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{profileInitial.toUpperCase()}</Text>
                    )}

                    <View style={styles.avatarEditBadge}>
                      {isUploadingAvatar || isPickingAvatar ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <MaterialIcons name="edit" size={14} color={COLORS.white} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                <Text style={styles.profileNameCompact}>
                  {firstName || lastName ? `${firstName} ${lastName}` : user?.phoneNumber || 'Guest'}
                </Text>
              </View>

              <TouchableOpacity style={styles.menuCloseButton} onPress={() => setShowMenu(false)}>
                <Text style={styles.menuCloseButtonText}>X</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuItemsList}>
              <TouchableOpacity
                style={styles.menuListItem}
                onPress={() => {
                  setShowMenu(false);
                  setShowProfileModal(true);
                }}
              >
                <View style={styles.menuListIconWrap}>
                  <MaterialIcons name="person" size={20} color={COLORS.teal} />
                </View>
                <Text style={styles.menuListItemText}>Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuListItem}
                onPress={() => {
                  setShowMenu(false);
                  setAlertState({
                    visible: true,
                    type: 'info',
                    title: 'Payment',
                    message: 'Payment settings will be enabled in the next iteration.',
                  });
                }}
              >
                <View style={styles.menuListIconWrap}>
                  <MaterialIcons name="payment" size={20} color={COLORS.teal} />
                </View>
                <Text style={styles.menuListItemText}>Payment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuListItem}
                onPress={() => {
                  setShowMenu(false);
                  setAlertState({
                    visible: true,
                    type: 'info',
                    title: 'Trip history',
                    message: 'Trip history will be enabled in the next iteration.',
                  });
                }}
              >
                <View style={styles.menuListIconWrap}>
                  <MaterialIcons name="history" size={20} color={COLORS.teal} />
                </View>
                <Text style={styles.menuListItemText}>Trip history</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuListItem}
                onPress={() => {
                  setShowMenu(false);
                  setAlertState({
                    visible: true,
                    type: 'info',
                    title: 'Notifications',
                    message: 'No new notifications.',
                  });
                }}
              >
                <View style={styles.menuListIconWrap}>
                  <MaterialIcons name="notifications" size={20} color={COLORS.teal} />
                </View>
                <Text style={styles.menuListItemText}>Notification</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuListItem}
                onPress={() => {
                  setShowMenu(false);
                  setAlertState({
                    visible: true,
                    type: 'info',
                    title: 'Settings',
                    message: 'Settings will be enabled in the next iteration.',
                  });
                }}
              >
                <View style={styles.menuListIconWrap}>
                  <MaterialIcons name="settings" size={20} color={COLORS.teal} />
                </View>
                <Text style={styles.menuListItemText}>Settings</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuBottomActions}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
                <MaterialIcons name="logout" size={20} color={COLORS.white} />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Profile editor modal. */}
      <Modal visible={showProfileModal} animationType="slide" transparent={true} onRequestClose={() => setShowProfileModal(false)}>
        <KeyboardAvoidingView
          style={styles.profileModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <View
            style={[
              styles.profileModal,
              {
                padding: modalPadding,
                width: profileModalWidth,
                maxHeight: profileModalMaxHeight,
                minHeight: profileModalMinHeight,
              },
            ]}
          >
            <View style={styles.profileModalHeader}>
              <Text style={styles.profileModalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <Text style={styles.closeButton}>X</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileFormArea}>
              <ScrollView
                style={styles.profileFormScroll}
                contentContainerStyle={[
                  styles.profileFormContent,
                  { paddingBottom: Math.max(insets.bottom + 12, 16) },
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                showsVerticalScrollIndicator={false}
              >
                <Input
                  label="First Name"
                  value={firstName}
                  onChangeText={(value) => {
                    setFirstName(value);
                    if (profileErrors.firstName) {
                      setProfileErrors((prev) => ({ ...prev, firstName: '' }));
                    }
                  }}
                  placeholder="Enter first name"
                  leftIcon={<MaterialIcons name="person-outline" size={20} color={COLORS.teal} />}
                  hideDefaultPrefixIcon={true}
                  error={profileErrors.firstName}
                />
                <Input
                  label="Last Name"
                  value={lastName}
                  onChangeText={(value) => {
                    setLastName(value);
                    if (profileErrors.lastName) {
                      setProfileErrors((prev) => ({ ...prev, lastName: '' }));
                    }
                  }}
                  placeholder="Enter last name"
                  leftIcon={<MaterialIcons name="badge" size={20} color={COLORS.teal} />}
                  hideDefaultPrefixIcon={true}
                  error={profileErrors.lastName}
                />
                <Input
                  label="Email"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (profileErrors.email) {
                      setProfileErrors((prev) => ({ ...prev, email: '' }));
                    }
                  }}
                  placeholder="Enter email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={<MaterialIcons name="alternate-email" size={20} color={COLORS.teal} />}
                  hideDefaultPrefixIcon={true}
                  cursorColor={COLORS.teal}
                  selectionColor={COLORS.teal}
                  showCursor={true}
                  error={profileErrors.email}
                />
                <Text
                  style={[
                    styles.emailGuideText,
                    normalizedEmailForHint.length === 0
                      ? styles.emailGuideNeutral
                      : isTypedEmailValid
                        ? styles.emailGuideSuccess
                        : styles.emailGuideError,
                  ]}
                >
                  {emailGuideMessage}
                </Text>
                <Input
                  label="Home Address"
                  value={homeAddress}
                  onChangeText={setHomeAddress}
                  placeholder="Enter home address"
                  leftIcon={<MaterialIcons name="home" size={20} color={COLORS.teal} />}
                  hideDefaultPrefixIcon={true}
                />
                <Input
                  label="Work Address"
                  value={workAddress}
                  onChangeText={setWorkAddress}
                  placeholder="Enter work address"
                  leftIcon={<MaterialIcons name="work-outline" size={20} color={COLORS.teal} />}
                  hideDefaultPrefixIcon={true}
                />
              </ScrollView>
            </View>

            <View style={styles.profileFooter}>
              <Button
                title={isSavingProfile ? 'Saving...' : 'Save Changes'}
                onPress={handleUpdateProfile}
                disabled={isSavingProfile}
                style={styles.saveButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reusable custom alert overlay for status messages. */}
      <AlertOverlay
        visible={alertState.visible}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState((prev) => ({ ...prev, visible: false }))}
      />
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
  },
  headerButton: {
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  menuIcon: {
    fontSize: 20,
    color: COLORS.text,
  },
  notificationIcon: {
    fontSize: 20,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 20,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
  panelHandleTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHandleButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHandle: {
    width: 52,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.border,
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  panelHeaderRowCentered: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  panelHeaderTitleWrap: {
    flex: 1,
    marginRight: 12,
  },
  panelHeaderCaption: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  panelTitleLarge: {
    fontSize: FONTS.sizes.xlarge,
    fontWeight: '800',
    color: COLORS.text,
  },
  panelTitle: {
    fontSize: FONTS.sizes.large,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  paymentChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.backgroundSecondary,
  },
  paymentChipText: {
    fontSize: FONTS.sizes.small,
    fontWeight: '700',
    color: COLORS.primary,
  },
  whereToButton: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    minHeight: SIZES.buttonHeight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchCardLeadingIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  whereToTextWrap: {
    flex: 1,
  },
  whereToPrompt: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '400',
    color: COLORS.text,
  },
  whereToHint: {
    marginTop: 3,
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
  },
  quickActionsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  quickActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 42,
  },
  outlineAccentChip: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.white,
  },
  savedPlacesAddAddressButton: {
    marginBottom: 10,
  },
  quickActionText: {
    fontSize: FONTS.sizes.small,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: 6,
  },
  outlineAccentChipText: {
    color: COLORS.secondary,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.small,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  recentSectionTitle: {
    fontSize: FONTS.sizes.small,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  savedPlacesColumn: {
    marginBottom: 14,
  },
  savedPlacesRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  savedPlaceButton: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FAINT_TEAL_DIVIDER,
    paddingVertical: 12,
    paddingHorizontal: 2,
    backgroundColor: 'transparent',
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 0,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  rowTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  savedPlaceLabel: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
    color: COLORS.teal,
  },
  savedPlaceSubtitle: {
    marginTop: 2,
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
  },
  recentItem: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FAINT_TEAL_DIVIDER,
    paddingVertical: 12,
    paddingHorizontal: 2,
    backgroundColor: 'transparent',
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentItemTitle: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
    color: COLORS.teal,
  },
  recentItemSubtitle: {
    marginTop: 2,
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
  },
  panelHeaderSpacer: {
    width: 38,
    height: 38,
  },
  headerClearButton: {
    minWidth: 38,
    height: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerClearButtonText: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
    color: COLORS.teal,
  },
  smallBackButton: {
    width: 38,
    height: 38,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  smallBackButtonText: {
    fontSize: FONTS.sizes.small,
    fontWeight: '600',
    color: COLORS.text,
  },
  searchInputLike: {
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: SIZES.buttonHeight,
  },
  searchInputIcon: {
    marginRight: 8,
  },
  searchInputField: {
    height: SIZES.buttonHeight - 2,
    flex: 1,
    fontSize: FONTS.sizes.regular,
    color: COLORS.text,
  },
  searchClearButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputHint: {
    marginTop: 6,
    marginBottom: 10,
    marginLeft: 2,
    color: COLORS.textLight,
    fontSize: FONTS.sizes.tiny,
    fontWeight: '600',
  },
  searchActionsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    marginTop: 2,
  },
  searchActionButton: {
    flex: 1,
  },
  searchActionButtonSpacing: {
    marginRight: 8,
  },
  searchActionButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  searchActionTextActive: {
    color: COLORS.white,
  },
  resultTagPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  searchResultTag: {
    fontSize: FONTS.sizes.tiny,
    fontWeight: '700',
    color: COLORS.primary,
  },
  searchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchLoadingText: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  searchEmptyState: {
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchEmptyText: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
  },
  stateCard: {
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.medium,
  },
  stateCardTitle: {
    fontSize: FONTS.sizes.small,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  stateCardValue: {
    fontSize: FONTS.sizes.large,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  stateCardHint: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  pickupSummaryCard: {
    marginTop: 2,
  },
  pickupDestinationSubline: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
    marginTop: -4,
    marginBottom: 12,
  },
  pickupCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  pickupBadge: {
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pickupBadgeText: {
    fontSize: FONTS.sizes.tiny,
    fontWeight: '700',
    color: COLORS.primary,
  },
  pickupWarningCard: {
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: WARNING_BORDER_TINT,
    backgroundColor: WARNING_BG_TINT,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickupWarningText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.small,
    lineHeight: 18,
    marginLeft: 8,
    flex: 1,
  },
  routePreviewCard: {
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    padding: 12,
    marginBottom: 12,
  },
  routePreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  routePreviewTrackColumn: {
    width: 30,
    alignItems: 'center',
    marginTop: 2,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.white,
    ...SHADOWS.small,
  },
  routeDotPickup: {
    backgroundColor: COLORS.secondary,
  },
  routeDotDestination: {
    backgroundColor: COLORS.teal,
  },
  routeConnectorWrap: {
    width: 20,
    height: ROUTE_PREVIEW_CONNECTOR_HEIGHT,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  routeConnectorLine: {
    width: 4,
    height: '100%',
    borderRadius: 999,
    backgroundColor: `${COLORS.teal}78`,
  },
  routeConnectorPulse: {
    position: 'absolute',
    top: 0,
    width: ROUTE_PREVIEW_PULSE_SIZE,
    height: ROUTE_PREVIEW_PULSE_SIZE,
    borderRadius: ROUTE_PREVIEW_PULSE_SIZE / 2,
    borderWidth: 1,
    borderColor: COLORS.teal,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  routeStopsColumn: {
    flex: 1,
    paddingLeft: 2,
  },
  routeStopBlock: {
    minHeight: 42,
  },
  routeStopLabel: {
    fontSize: FONTS.sizes.tiny,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  routeStopTitle: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
    color: COLORS.teal,
  },
  routeStopSubtitle: {
    marginTop: 2,
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
  },
  routeStopsSpacer: {
    height: 16,
  },
  rideOptionCard: {
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideOptionImageWrap: {
    width: 88,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  rideOptionImage: {
    width: '100%',
    height: '100%',
  },
  rideOptionTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  rideOptionFareWrap: {
    minWidth: 72,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  rideOptionFareText: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
    color: COLORS.text,
  },
  rideOptionFareError: {
    marginBottom: 8,
    fontSize: FONTS.sizes.tiny,
    color: COLORS.error,
  },
  rideOptionTitle: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
    color: COLORS.teal,
  },
  rideOptionMeta: {
    marginTop: 3,
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
  },
  mapPinCandidateTitle: {
    marginTop: 12,
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
    color: COLORS.text,
  },
  mapPinCandidateSubtitle: {
    marginTop: 2,
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
  },
  previewActionsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  previewButtonSingle: {
    marginTop: 14,
  },
  previewPrimaryButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.buttonHeight,
    ...SHADOWS.medium,
  },
  previewPrimaryButtonDisabled: {
    opacity: 0.5,
  },
  previewPrimaryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
  },
  previewSecondaryButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    minHeight: SIZES.buttonHeight,
  },
  previewSecondaryButtonText: {
    color: COLORS.secondary,
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
  },
  pinDropOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  pinDropTip: {
    marginTop: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.teal,
  },
  mapControlsContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
    elevation: 10,
  },
  mapControlButton: {
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sideMenu: {
    height: '100%',
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
  },
  sideMenuTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  menuProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  menuCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightGray,
  },
  menuCloseButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  profileAvatar: {
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 999,
  },
  avatarText: {
    fontSize: 24,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.teal,
    borderWidth: 1,
    borderColor: COLORS.white,
    zIndex: 2,
  },
  profileNameCompact: {
    fontSize: FONTS.sizes.regular,
    fontWeight: '700',
    color: COLORS.teal,
    flexShrink: 1,
  },
  menuItemsList: {
    gap: 12,
  },
  menuListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  menuListIconWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuListItemText: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuBottomActions: {
    marginTop: 'auto',
    paddingTop: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.teal,
    paddingVertical: 12,
  },
  logoutButtonText: {
    fontSize: FONTS.sizes.medium,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 8,
  },
  closeButton: {
    fontSize: 22,
    color: COLORS.textSecondary,
    fontWeight: '700',
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
  profileFormArea: {
    flex: 1,
    width: '100%',
  },
  profileFormScroll: {
    flex: 1,
    width: '100%',
  },
  profileFormContent: {
    paddingBottom: 4,
  },
  emailGuideText: {
    fontSize: FONTS.sizes.tiny,
    marginTop: -8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  emailGuideNeutral: {
    color: COLORS.textSecondary,
  },
  emailGuideSuccess: {
    color: COLORS.success,
    fontWeight: '600',
  },
  emailGuideError: {
    color: COLORS.error,
    fontWeight: '600',
  },
  profileFooter: {
    paddingTop: 10,
  },
  saveButton: {
    backgroundColor: COLORS.teal,
    marginBottom: 4,
  },
});

export default HomeScreen;

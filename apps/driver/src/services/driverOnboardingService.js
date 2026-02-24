import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import storage from '@react-native-firebase/storage';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { db } from '../../firebase.config';
import { driverOnboardingConfig } from '../utils/driverOnboardingConfig';

const {
  BACKGROUND_CHECK_STATUSES,
  DOCUMENT_STATUSES,
  DRIVER_STATUSES,
  DOCUMENT_TYPES,
  ONBOARDING_STEPS,
  REQUIRED_DOCUMENT_TYPES,
  VEHICLE_STATUSES,
  evaluateDriverEligibility,
  isDateExpired,
} = require('./driverEligibility');

const snapshotExists = (snapshot) =>
  typeof snapshot?.exists === 'function' ? snapshot.exists() : Boolean(snapshot?.exists);

const getSnapshotData = (snapshot) => {
  if (!snapshot) return {};
  if (typeof snapshot.data === 'function') {
    return snapshot.data() || {};
  }
  return snapshot.data || {};
};

const normalizeUid = (uid) => String(uid || '').trim();

const normalizePlate = (plate) => String(plate || '').trim().toUpperCase().replace(/\s+/g, '');
const allowedDocumentExtensions = Object.freeze(['jpg', 'jpeg', 'png', 'pdf']);
const allowedImageExtensions = Object.freeze(['jpg', 'jpeg', 'png']);
const VEHICLE_IMAGE_SLOTS = Object.freeze({
  INTERIOR: 'INTERIOR',
  EXTERIOR: 'EXTERIOR',
  PLATE: 'PLATE',
});
const buildGeneratedDocumentId = (type) => {
  const normalizedType = String(type || 'DOC').trim().toUpperCase();
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `DRV-${normalizedType}-${timestamp}-${randomSuffix}`;
};

const buildStorageFilePath = ({ uid, type, extension }) => {
  const safeUid = normalizeUid(uid);
  const safeType = String(type || '').trim().toUpperCase();
  const safeExt = String(extension || 'jpg').trim().toLowerCase();
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `driver_docs/${safeUid}/${safeType}/${Date.now()}-${randomPart}.${safeExt}`;
};

const ensureAllowedDocumentMimeType = (mimeType) => {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  if (!driverOnboardingConfig.allowedDocumentMimeTypes.includes(normalizedMimeType)) {
    throw new Error('Unsupported file type. Upload JPG, JPEG, PNG, or PDF.');
  }
  return normalizedMimeType;
};

const resolveAssetExtension = (asset = {}) => {
  const fileNameExt = String(asset?.fileName || asset?.name || '')
    .split('.')
    .pop()
    ?.toLowerCase();

  if (fileNameExt && allowedDocumentExtensions.includes(fileNameExt)) {
    if (fileNameExt === 'jpeg') return 'jpg';
    return fileNameExt;
  }

  const mimeType = String(asset?.mimeType || '').toLowerCase();
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('png')) return 'png';
  return 'jpg';
};

const resolveImageAssetExtension = (asset = {}) => {
  const fileNameExt = String(asset?.fileName || asset?.name || '')
    .split('.')
    .pop()
    ?.toLowerCase();

  if (fileNameExt && allowedImageExtensions.includes(fileNameExt)) {
    return fileNameExt === 'jpeg' ? 'jpg' : fileNameExt;
  }

  const mimeType = String(asset?.mimeType || '').toLowerCase();
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  return '';
};

const ensureAllowedImageMimeType = (mimeType) => {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(normalizedMimeType)) {
    throw new Error('Only JPG, JPEG, or PNG images are allowed for vehicle photos.');
  }
  return normalizedMimeType;
};

const normalizeVehicleImageSlot = (slot) => {
  const normalizedSlot = String(slot || '').trim().toUpperCase();
  if (!Object.values(VEHICLE_IMAGE_SLOTS).includes(normalizedSlot)) {
    throw new Error('Invalid vehicle image type selected.');
  }
  return normalizedSlot;
};

const vehicleImageSlotToField = {
  [VEHICLE_IMAGE_SLOTS.INTERIOR]: 'interior',
  [VEHICLE_IMAGE_SLOTS.EXTERIOR]: 'exterior',
  [VEHICLE_IMAGE_SLOTS.PLATE]: 'plate',
};

const getDocStatusWithExpiry = (documentItem = {}, now = new Date()) => {
  const rawStatus = String(documentItem?.status || DOCUMENT_STATUSES.PENDING).toUpperCase();
  if (isDateExpired(documentItem?.expiryDate, now)) {
    return DOCUMENT_STATUSES.EXPIRED;
  }
  return rawStatus;
};

const mapDocumentsByType = (documentsSnapshot = []) => {
  return documentsSnapshot.reduce((acc, snapshotItem) => {
    const docData = getSnapshotData(snapshotItem);
    const type = String(docData?.type || snapshotItem?.id || '')
      .trim()
      .toUpperCase();

    if (!type) return acc;
    acc[type] = {
      id: snapshotItem.id,
      ...docData,
    };
    return acc;
  }, {});
};

const fetchDriverSnapshot = async (uid) => {
  const normalizedUid = normalizeUid(uid);
  if (!normalizedUid) {
    throw new Error('Missing user uid for driver onboarding.');
  }

  const driverRef = doc(db, 'drivers', normalizedUid);
  const vehicleRef = doc(db, 'drivers', normalizedUid, 'vehicle', 'current');
  const backgroundRef = doc(db, 'drivers', normalizedUid, 'backgroundCheck', 'current');
  const agreementsRef = doc(db, 'drivers', normalizedUid, 'agreements', 'current');
  const docsRef = collection(db, 'drivers', normalizedUid, 'documents');

  const [driverSnap, vehicleSnap, backgroundSnap, agreementsSnap, docsSnap] = await Promise.all([
    getDoc(driverRef),
    getDoc(vehicleRef),
    getDoc(backgroundRef),
    getDoc(agreementsRef),
    getDocs(docsRef),
  ]);

  const documentsByType = mapDocumentsByType(docsSnap?.docs || []);
  return {
    uid: normalizedUid,
    driverRef,
    snapshot: {
      driver: snapshotExists(driverSnap) ? getSnapshotData(driverSnap) : null,
      vehicle: snapshotExists(vehicleSnap) ? getSnapshotData(vehicleSnap) : null,
      backgroundCheck: snapshotExists(backgroundSnap) ? getSnapshotData(backgroundSnap) : null,
      agreements: snapshotExists(agreementsSnap) ? getSnapshotData(agreementsSnap) : null,
      documentsByType,
    },
  };
};

export const createEmptyDriverRecord = (uid, user = {}) => ({
  uid,
  status: DRIVER_STATUSES.UNVERIFIED,
  onboardingStep: ONBOARDING_STEPS.ACCOUNT,
  accountVerified: Boolean(user?.phoneNumber || user?.email),
  fullName: String(user?.displayName || '').trim(),
  dob: '',
  phone: String(user?.phoneNumber || '').trim(),
  email: String(user?.email || '').trim().toLowerCase(),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

export const ensureDriverRecord = async (user) => {
  const uid = normalizeUid(user?.uid);
  if (!uid) throw new Error('Cannot initialize driver record without auth user.');

  const driverRef = doc(db, 'drivers', uid);
  const driverSnap = await getDoc(driverRef);
  if (!snapshotExists(driverSnap)) {
    await setDoc(driverRef, createEmptyDriverRecord(uid, user), { merge: true });
  } else {
    const existingDriver = getSnapshotData(driverSnap);
    const existingStatus = String(existingDriver?.status || '').toUpperCase();
    const normalizedStatus = Object.values(DRIVER_STATUSES).includes(existingStatus)
      ? existingStatus
      : DRIVER_STATUSES.UNVERIFIED;
    const existingStep = String(existingDriver?.onboardingStep || '').toUpperCase();
    const normalizedStep = Object.values(ONBOARDING_STEPS).includes(existingStep)
      ? existingStep
      : ONBOARDING_STEPS.ACCOUNT;
    await setDoc(
      driverRef,
      {
        uid,
        status: normalizedStatus,
        onboardingStep: normalizedStep,
        accountVerified:
          typeof existingDriver?.accountVerified === 'boolean'
            ? existingDriver.accountVerified
            : Boolean(user?.phoneNumber || user?.email),
        phone: String(user?.phoneNumber || '').trim(),
        email: String(user?.email || '').trim().toLowerCase(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  const agreementsRef = doc(db, 'drivers', uid, 'agreements', 'current');
  const backgroundRef = doc(db, 'drivers', uid, 'backgroundCheck', 'current');
  const [agreementsSnap, backgroundSnap] = await Promise.all([getDoc(agreementsRef), getDoc(backgroundRef)]);

  if (!snapshotExists(agreementsSnap)) {
    await setDoc(
      agreementsRef,
      {
        termsAcceptedAt: null,
        safetyAcceptedAt: null,
        commissionAcceptedAt: null,
        trainingPassedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  if (!snapshotExists(backgroundSnap)) {
    await setDoc(
      backgroundRef,
      {
        status: BACKGROUND_CHECK_STATUSES.NOT_STARTED,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return loadDriverOnboarding(uid);
};

export const loadDriverOnboarding = async (uid, options = {}) => {
  const { snapshot } = await fetchDriverSnapshot(uid);
  const eligibility = evaluateDriverEligibility(snapshot, {
    backgroundCheckRequired: Boolean(
      options.backgroundCheckRequired ?? driverOnboardingConfig.backgroundCheckRequired
    ),
  });

  const documents = Object.values(snapshot.documentsByType || {}).map((item) => ({
    ...item,
    statusForEligibility: getDocStatusWithExpiry(item),
  }));

  return {
    driver: snapshot.driver,
    vehicle: snapshot.vehicle,
    backgroundCheck: snapshot.backgroundCheck,
    agreements: snapshot.agreements,
    documentsByType: snapshot.documentsByType || {},
    documents,
    eligibility,
  };
};

export const computeDriverEligibility = async (uid, options = {}) => {
  const { snapshot } = await fetchDriverSnapshot(uid);
  return evaluateDriverEligibility(snapshot, {
    backgroundCheckRequired: Boolean(
      options.backgroundCheckRequired ?? driverOnboardingConfig.backgroundCheckRequired
    ),
  });
};

export const saveDriverProfile = async (uid, payload = {}) => {
  const normalizedUid = normalizeUid(uid);
  if (!normalizedUid) throw new Error('Missing uid for driver profile save.');

  const fullName = String(payload.fullName || '').trim();
  const dob = String(payload.dob || '').trim();
  const phone = String(payload.phone || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();

  await setDoc(
    doc(db, 'drivers', normalizedUid),
    {
      fullName,
      dob,
      phone,
      email,
      accountVerified: true,
      onboardingStep: ONBOARDING_STEPS.DOCUMENTS,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return loadDriverOnboarding(normalizedUid);
};

export const uploadDriverDocumentFile = async ({ uid, type, asset }) => {
  const normalizedUid = normalizeUid(uid);
  const normalizedType = String(type || '').trim().toUpperCase();
  if (!normalizedUid) throw new Error('Missing uid for document upload.');
  if (!Object.values(DOCUMENT_TYPES).includes(normalizedType)) {
    throw new Error(`Invalid document type: ${normalizedType || 'UNKNOWN'}`);
  }
  if (!asset?.uri) throw new Error('Document file is missing.');

  const resolvedExtension = resolveAssetExtension(asset);
  const fallbackMimeType =
    resolvedExtension === 'pdf' ? 'application/pdf' : `image/${resolvedExtension}`;
  const assetMimeType = String(asset?.mimeType || '').trim().toLowerCase();
  const normalizedMimeType =
    !assetMimeType || assetMimeType === 'application/octet-stream'
      ? fallbackMimeType
      : assetMimeType;
  const mimeType = ensureAllowedDocumentMimeType(normalizedMimeType);

  const fileSize = Number(asset?.fileSize || asset?.size || 0);
  if (fileSize > 0 && fileSize > driverOnboardingConfig.maxDocumentFileSizeBytes) {
    const maxSizeMb = Math.round(driverOnboardingConfig.maxDocumentFileSizeBytes / (1024 * 1024));
    const currentFileSizeMb = (fileSize / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File is too large (${currentFileSizeMb}MB). Maximum allowed size is ${maxSizeMb}MB.`
    );
  }

  const extension = resolvedExtension;
  const filePath = buildStorageFilePath({
    uid: normalizedUid,
    type: normalizedType,
    extension,
  });

  const reference = storage().ref(filePath);
  const uploadUri =
    asset.uri.startsWith('file://') && asset.uri.length > 7 ? asset.uri.replace('file://', '') : asset.uri;
  const uploadSnapshot = asset.base64
    ? await reference.putString(asset.base64, 'base64', { contentType: mimeType })
    : await reference.putFile(uploadUri, { contentType: mimeType });
  const downloadUrl = await (uploadSnapshot?.ref || reference).getDownloadURL();

  return {
    filePath,
    downloadUrl,
    mimeType,
  };
};

export const uploadVehicleImageFile = async ({ uid, slot, asset }) => {
  const normalizedUid = normalizeUid(uid);
  const normalizedSlot = normalizeVehicleImageSlot(slot);
  if (!normalizedUid) throw new Error('Missing uid for vehicle image upload.');
  if (!asset?.uri) throw new Error('Vehicle image file is missing.');

  const extension = resolveImageAssetExtension(asset);
  if (!extension) {
    throw new Error('Unsupported file type. Upload JPG, JPEG, or PNG images only.');
  }
  const fallbackMimeType = `image/${extension}`;
  const assetMimeType = String(asset?.mimeType || '').trim().toLowerCase();
  const normalizedMimeType =
    !assetMimeType || assetMimeType === 'application/octet-stream'
      ? fallbackMimeType
      : assetMimeType;
  const mimeType = ensureAllowedImageMimeType(normalizedMimeType);

  const fileSize = Number(asset?.fileSize || asset?.size || 0);
  if (fileSize > 0 && fileSize > driverOnboardingConfig.maxDocumentFileSizeBytes) {
    const maxSizeMb = Math.round(driverOnboardingConfig.maxDocumentFileSizeBytes / (1024 * 1024));
    const currentFileSizeMb = (fileSize / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File is too large (${currentFileSizeMb}MB). Maximum allowed size is ${maxSizeMb}MB.`
    );
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  const filePath = `driver_docs/${normalizedUid}/VEHICLE_IMAGES/${normalizedSlot}-${Date.now()}-${randomPart}.${extension}`;
  const reference = storage().ref(filePath);
  const uploadUri =
    asset.uri.startsWith('file://') && asset.uri.length > 7 ? asset.uri.replace('file://', '') : asset.uri;
  const uploadSnapshot = await reference.putFile(uploadUri, { contentType: mimeType });
  const downloadUrl = await (uploadSnapshot?.ref || reference).getDownloadURL();

  return {
    filePath,
    downloadUrl,
    mimeType,
    slot: normalizedSlot,
  };
};

export const saveDriverVehicleImageMetadata = async (uid, payload = {}) => {
  const normalizedUid = normalizeUid(uid);
  const normalizedSlot = normalizeVehicleImageSlot(payload.slot);
  if (!normalizedUid) throw new Error('Missing uid for vehicle image save.');

  const imageField = vehicleImageSlotToField[normalizedSlot];
  await setDoc(
    doc(db, 'drivers', normalizedUid, 'vehicle', 'current'),
    {
      status: VEHICLE_STATUSES.PENDING,
      images: {
        [imageField]: {
          slot: normalizedSlot,
          filePath: String(payload.filePath || '').trim(),
          downloadUrl: String(payload.downloadUrl || '').trim() || null,
          mimeType: String(payload.mimeType || '').trim().toLowerCase() || null,
          updatedAt: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return loadDriverOnboarding(normalizedUid);
};

export const saveDriverDocumentMetadata = async (uid, payload = {}) => {
  const normalizedUid = normalizeUid(uid);
  const type = String(payload.type || '').trim().toUpperCase();
  if (!normalizedUid) throw new Error('Missing uid for document metadata save.');
  if (!Object.values(DOCUMENT_TYPES).includes(type)) {
    throw new Error(`Invalid document type: ${type || 'UNKNOWN'}`);
  }

  await setDoc(
    doc(db, 'drivers', normalizedUid, 'documents', type),
    {
      type,
      generatedId: buildGeneratedDocumentId(type),
      documentNumber: String(payload.documentNumber || '').trim() || null,
      expiryDate: payload.expiryDate || null,
      filePath: String(payload.filePath || '').trim(),
      downloadUrl: String(payload.downloadUrl || '').trim() || null,
      mimeType: String(payload.mimeType || '').trim().toLowerCase() || null,
      status: DOCUMENT_STATUSES.PENDING,
      rejectionReason: null,
      reviewedAt: null,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, 'drivers', normalizedUid),
    {
      onboardingStep: ONBOARDING_STEPS.VEHICLE,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return loadDriverOnboarding(normalizedUid);
};

export const saveDriverVehicle = async (uid, vehiclePayload = {}) => {
  const normalizedUid = normalizeUid(uid);
  if (!normalizedUid) throw new Error('Missing uid for vehicle save.');

  const plate = normalizePlate(vehiclePayload.plate);
  if (!plate) throw new Error('Vehicle plate is required.');

  const vehicleRef = doc(db, 'drivers', normalizedUid, 'vehicle', 'current');
  const plateRef = doc(db, 'plates', plate);
  const driverRef = doc(db, 'drivers', normalizedUid);

  await runTransaction(db, async (transaction) => {
    const [vehicleSnap, plateSnap] = await Promise.all([
      transaction.get(vehicleRef),
      transaction.get(plateRef),
    ]);

    const existingVehicle = snapshotExists(vehicleSnap) ? getSnapshotData(vehicleSnap) : {};
    const currentPlate = normalizePlate(existingVehicle?.plate);

    if (snapshotExists(plateSnap)) {
      const plateData = getSnapshotData(plateSnap);
      if (String(plateData?.driverUid || '') !== normalizedUid) {
        throw new Error('This plate is already assigned to another driver.');
      }
    }

    if (currentPlate && currentPlate !== plate) {
      const currentPlateRef = doc(db, 'plates', currentPlate);
      const currentPlateSnap = await transaction.get(currentPlateRef);
      if (snapshotExists(currentPlateSnap)) {
        const currentPlateData = getSnapshotData(currentPlateSnap);
        if (String(currentPlateData?.driverUid || '') === normalizedUid) {
          transaction.delete(currentPlateRef);
        }
      }
    }

    transaction.set(
      plateRef,
      {
        driverUid: normalizedUid,
        plate,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      vehicleRef,
      {
        make: String(vehiclePayload.make || '').trim(),
        model: String(vehiclePayload.model || '').trim(),
        year: String(vehiclePayload.year || '').trim(),
        color: String(vehiclePayload.color || '').trim(),
        plate,
        category: String(vehiclePayload.category || '').trim().toUpperCase(),
        status: VEHICLE_STATUSES.PENDING,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      driverRef,
      {
        onboardingStep: ONBOARDING_STEPS.BACKGROUND,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return loadDriverOnboarding(normalizedUid);
};

export const saveDriverAgreements = async (uid, agreementsPayload = {}) => {
  const normalizedUid = normalizeUid(uid);
  if (!normalizedUid) throw new Error('Missing uid for agreements save.');

  const agreementRef = doc(db, 'drivers', normalizedUid, 'agreements', 'current');
  const nowTimestamp = serverTimestamp();

  await setDoc(
    agreementRef,
    {
      termsAcceptedAt: agreementsPayload.termsAccepted ? nowTimestamp : null,
      safetyAcceptedAt: agreementsPayload.safetyAccepted ? nowTimestamp : null,
      commissionAcceptedAt: agreementsPayload.commissionAccepted ? nowTimestamp : null,
      trainingPassedAt: agreementsPayload.trainingPassed ? nowTimestamp : null,
      updatedAt: nowTimestamp,
    },
    { merge: true }
  );

  await setDoc(
    doc(db, 'drivers', normalizedUid),
    {
      onboardingStep: ONBOARDING_STEPS.REVIEW,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return loadDriverOnboarding(normalizedUid);
};

export const submitDriverForReview = async (uid, options = {}) => {
  const normalizedUid = normalizeUid(uid);
  if (!normalizedUid) throw new Error('Missing uid for review submission.');

  const eligibility = await computeDriverEligibility(normalizedUid, options);
  if (!eligibility.canSubmitForReview) {
    return {
      success: false,
      eligibility,
    };
  }

  await setDoc(
    doc(db, 'drivers', normalizedUid),
    {
      status: DRIVER_STATUSES.PENDING_REVIEW,
      onboardingStep: ONBOARDING_STEPS.REVIEW,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    success: true,
    eligibility,
    onboarding: await loadDriverOnboarding(normalizedUid, options),
  };
};

export const setDriverAvailability = async (uid, isOnline, options = {}) => {
  const normalizedUid = normalizeUid(uid);
  if (!normalizedUid) throw new Error('Missing uid for availability update.');

  const wantsOnline = Boolean(isOnline);
  const eligibility = await computeDriverEligibility(normalizedUid, options);
  if (wantsOnline && !eligibility.canGoOnline) {
    return {
      success: false,
      eligibility,
    };
  }

  await setDoc(
    doc(db, 'drivers', normalizedUid),
    {
      isOnline: wantsOnline,
      availability: {
        isOnline: wantsOnline,
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    success: true,
    eligibility,
  };
};

export const pickImageDocumentFromLibrary = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: driverOnboardingConfig.allowedDocumentMimeTypes,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }
  const pickedAsset = result.assets[0];
  const extension = resolveAssetExtension(pickedAsset);
  if (!allowedDocumentExtensions.includes(extension)) {
    throw new Error('Unsupported file type. Upload JPG, JPEG, PNG, or PDF.');
  }

  return {
    uri: pickedAsset.uri,
    mimeType: pickedAsset.mimeType || (extension === 'pdf' ? 'application/pdf' : `image/${extension}`),
    fileName: pickedAsset.name || `document.${extension}`,
    fileSize: Number(pickedAsset.size || 0),
  };
};

const pickImageFromCamera = async () => {
  const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
  if (!permissionResult?.granted) {
    throw new Error('Camera permission is required to capture documents.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0];
};

export const pickImageDocumentFromCamera = async () => {
  const pickedAsset = await pickImageFromCamera();
  if (!pickedAsset) {
    return null;
  }

  const extension = resolveImageAssetExtension(pickedAsset);
  if (!extension) {
    throw new Error('Unsupported file type. Capture JPG, JPEG, or PNG images only.');
  }

  return {
    uri: pickedAsset.uri,
    mimeType: pickedAsset.mimeType || `image/${extension}`,
    fileName: pickedAsset.fileName || pickedAsset.name || `document-camera.${extension}`,
    fileSize: Number(pickedAsset.fileSize || pickedAsset.size || 0),
  };
};

export const pickVehicleImageFromLibrary = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/jpg', 'image/png'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const pickedAsset = result.assets[0];
  const extension = resolveImageAssetExtension(pickedAsset);
  if (!extension) {
    throw new Error('Unsupported file type. Upload JPG, JPEG, or PNG images only.');
  }

  return {
    uri: pickedAsset.uri,
    mimeType: pickedAsset.mimeType || `image/${extension}`,
    fileName: pickedAsset.name || `vehicle-image.${extension}`,
    fileSize: Number(pickedAsset.size || 0),
  };
};

export const pickVehicleImageFromCamera = async () => {
  const pickedAsset = await pickImageFromCamera();
  if (!pickedAsset) {
    return null;
  }

  const extension = resolveImageAssetExtension(pickedAsset);
  if (!extension) {
    throw new Error('Unsupported file type. Capture JPG, JPEG, or PNG images only.');
  }

  return {
    uri: pickedAsset.uri,
    mimeType: pickedAsset.mimeType || `image/${extension}`,
    fileName: pickedAsset.fileName || pickedAsset.name || `vehicle-camera.${extension}`,
    fileSize: Number(pickedAsset.fileSize || pickedAsset.size || 0),
  };
};

export const onboardingEnums = {
  DRIVER_STATUSES,
  ONBOARDING_STEPS,
  DOCUMENT_TYPES,
  REQUIRED_DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  VEHICLE_STATUSES,
  BACKGROUND_CHECK_STATUSES,
  VEHICLE_IMAGE_SLOTS,
};

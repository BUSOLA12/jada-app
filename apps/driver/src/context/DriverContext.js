import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  computeDriverEligibility,
  ensureDriverRecord,
  loadDriverOnboarding,
  onboardingEnums,
  saveDriverAgreements,
  saveDriverDocumentMetadata,
  saveDriverProfile,
  saveDriverVehicle,
  saveDriverVehicleImageMetadata,
  setDriverAvailability,
  submitDriverForReview,
  uploadDriverDocumentFile,
  uploadVehicleImageFile,
} from '../services/driverOnboardingService';
import { driverOnboardingConfig } from '../utils/driverOnboardingConfig';

export const DriverContext = createContext();

export const DriverProvider = ({ children }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [backgroundCheck, setBackgroundCheck] = useState(null);
  const [agreements, setAgreements] = useState(null);
  const [documentsByType, setDocumentsByType] = useState({});
  const [documents, setDocuments] = useState([]);
  const [eligibility, setEligibility] = useState({
    canSubmitForReview: false,
    canGoOnline: false,
    blockingReasons: [],
    missingItems: {
      documents: [],
      vehicle: true,
      agreements: true,
      background: false,
      rejectedOrExpiredDocuments: [],
      notApprovedDocuments: [],
    },
  });
  const [isOnline, setIsOnline] = useState(false);

  const clearState = useCallback(() => {
    setDriver(null);
    setVehicle(null);
    setBackgroundCheck(null);
    setAgreements(null);
    setDocumentsByType({});
    setDocuments([]);
    setEligibility({
      canSubmitForReview: false,
      canGoOnline: false,
      blockingReasons: [],
      missingItems: {
        documents: [],
        vehicle: true,
        agreements: true,
        background: false,
        rejectedOrExpiredDocuments: [],
        notApprovedDocuments: [],
      },
    });
    setIsOnline(false);
  }, []);

  const applyOnboardingPayload = useCallback((payload) => {
    setDriver(payload?.driver || null);
    setVehicle(payload?.vehicle || null);
    setBackgroundCheck(payload?.backgroundCheck || null);
    setAgreements(payload?.agreements || null);
    setDocumentsByType(payload?.documentsByType || {});
    setDocuments(payload?.documents || []);
    if (payload?.eligibility) {
      setEligibility(payload.eligibility);
    }
    setIsOnline(Boolean(payload?.driver?.isOnline || payload?.driver?.availability?.isOnline));
  }, []);

  const refreshDriver = useCallback(async () => {
    if (!user?.uid) {
      clearState();
      setLoading(false);
      return null;
    }

    setRefreshing(true);
    try {
      const onboarding = await loadDriverOnboarding(user.uid, {
        backgroundCheckRequired: driverOnboardingConfig.backgroundCheckRequired,
      });
      applyOnboardingPayload(onboarding);
      return onboarding;
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [applyOnboardingPayload, clearState, user?.uid]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!user?.uid) {
        clearState();
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const onboarding = await ensureDriverRecord(user);
        if (!cancelled) {
          applyOnboardingPayload(onboarding);
        }
      } catch (error) {
        if (!cancelled) {
          clearState();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [applyOnboardingPayload, clearState, user]);

  const updateProfile = useCallback(
    async (payload) => {
      if (!user?.uid) throw new Error('User not authenticated.');
      const onboarding = await saveDriverProfile(user.uid, payload);
      applyOnboardingPayload(onboarding);
      return onboarding;
    },
    [applyOnboardingPayload, user?.uid]
  );

  const uploadDocument = useCallback(
    async ({ type, asset, documentNumber, expiryDate }) => {
      if (!user?.uid) throw new Error('User not authenticated.');
      const uploadResult = await uploadDriverDocumentFile({
        uid: user.uid,
        type,
        asset,
      });
      const onboarding = await saveDriverDocumentMetadata(user.uid, {
        type,
        documentNumber,
        expiryDate,
        filePath: uploadResult.filePath,
        downloadUrl: uploadResult.downloadUrl,
        mimeType: uploadResult.mimeType,
      });
      applyOnboardingPayload(onboarding);
      return onboarding;
    },
    [applyOnboardingPayload, user?.uid]
  );

  const updateVehicle = useCallback(
    async (payload) => {
      if (!user?.uid) throw new Error('User not authenticated.');
      const onboarding = await saveDriverVehicle(user.uid, payload);
      applyOnboardingPayload(onboarding);
      return onboarding;
    },
    [applyOnboardingPayload, user?.uid]
  );

  const uploadVehicleImage = useCallback(
    async ({ slot, asset }) => {
      if (!user?.uid) throw new Error('User not authenticated.');
      const uploadResult = await uploadVehicleImageFile({
        uid: user.uid,
        slot,
        asset,
      });
      const onboarding = await saveDriverVehicleImageMetadata(user.uid, {
        slot: uploadResult.slot,
        filePath: uploadResult.filePath,
        downloadUrl: uploadResult.downloadUrl,
        mimeType: uploadResult.mimeType,
      });
      applyOnboardingPayload(onboarding);
      return onboarding;
    },
    [applyOnboardingPayload, user?.uid]
  );

  const updateAgreements = useCallback(
    async (payload) => {
      if (!user?.uid) throw new Error('User not authenticated.');
      const onboarding = await saveDriverAgreements(user.uid, payload);
      applyOnboardingPayload(onboarding);
      return onboarding;
    },
    [applyOnboardingPayload, user?.uid]
  );

  const submitForReview = useCallback(async () => {
    if (!user?.uid) throw new Error('User not authenticated.');
    const result = await submitDriverForReview(user.uid, {
      backgroundCheckRequired: driverOnboardingConfig.backgroundCheckRequired,
    });
    if (result.success && result.onboarding) {
      applyOnboardingPayload(result.onboarding);
    } else {
      const nextEligibility = await computeDriverEligibility(user.uid, {
        backgroundCheckRequired: driverOnboardingConfig.backgroundCheckRequired,
      });
      setEligibility(nextEligibility);
    }
    return result;
  }, [applyOnboardingPayload, user?.uid]);

  const setAvailabilityOnline = useCallback(
    async (nextOnline) => {
      if (!user?.uid) throw new Error('User not authenticated.');
      const result = await setDriverAvailability(user.uid, nextOnline, {
        backgroundCheckRequired: driverOnboardingConfig.backgroundCheckRequired,
      });
      if (result.success) {
        setIsOnline(Boolean(nextOnline));
        await refreshDriver();
      } else if (result.eligibility) {
        setEligibility(result.eligibility);
      }
      return result;
    },
    [refreshDriver, user?.uid]
  );

  const value = useMemo(
    () => ({
      loading,
      refreshing,
      driver,
      vehicle,
      backgroundCheck,
      agreements,
      documentsByType,
      documents,
      eligibility,
      isOnline,
      config: driverOnboardingConfig,
      enums: onboardingEnums,
      refreshDriver,
      updateProfile,
      uploadDocument,
      uploadVehicleImage,
      updateVehicle,
      updateAgreements,
      submitForReview,
      setAvailabilityOnline,
    }),
    [
      loading,
      refreshing,
      driver,
      vehicle,
      backgroundCheck,
      agreements,
      documentsByType,
      documents,
      eligibility,
      isOnline,
      refreshDriver,
      updateProfile,
      uploadDocument,
      uploadVehicleImage,
      updateVehicle,
      updateAgreements,
      submitForReview,
      setAvailabilityOnline,
    ]
  );

  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
};

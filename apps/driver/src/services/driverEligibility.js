const DRIVER_STATUSES = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
});

const ONBOARDING_STEPS = Object.freeze({
  ACCOUNT: 'ACCOUNT',
  DOCUMENTS: 'DOCUMENTS',
  VEHICLE: 'VEHICLE',
  BACKGROUND: 'BACKGROUND',
  TRAINING: 'TRAINING',
  REVIEW: 'REVIEW',
  DONE: 'DONE',
});

const DOCUMENT_TYPES = Object.freeze({
  LICENSE: 'LICENSE',
  GOV_ID: 'GOV_ID',
  PROFILE_PHOTO: 'PROFILE_PHOTO',
  VEHICLE_REG: 'VEHICLE_REG',
  INSURANCE: 'INSURANCE',
  ROADWORTHINESS: 'ROADWORTHINESS',
});

const REQUIRED_DOCUMENT_TYPES = Object.freeze([
  DOCUMENT_TYPES.LICENSE,
  DOCUMENT_TYPES.GOV_ID,
  DOCUMENT_TYPES.PROFILE_PHOTO,
  DOCUMENT_TYPES.VEHICLE_REG,
  DOCUMENT_TYPES.INSURANCE,
  DOCUMENT_TYPES.ROADWORTHINESS,
]);

const DOCUMENT_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
});

const VEHICLE_CATEGORIES = Object.freeze({
  ECONOMY: 'ECONOMY',
  PREMIUM: 'PREMIUM',
  XL: 'XL',
});

const VEHICLE_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const BACKGROUND_CHECK_STATUSES = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_REVIEW: 'IN_REVIEW',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
});

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const dateValue = value.toDate();
    return Number.isNaN(dateValue?.getTime?.()) ? null : dateValue;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const dateValue = new Date(value);
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }
  return null;
};

const isDateExpired = (value, now = new Date()) => {
  const dateValue = toDate(value);
  if (!dateValue) return false;
  return dateValue.getTime() < now.getTime();
};

const normalizeDocumentMap = (documents) => {
  if (!documents) return {};
  if (Array.isArray(documents)) {
    return documents.reduce((acc, item) => {
      const type = String(item?.type || '').trim().toUpperCase();
      if (!type) return acc;
      acc[type] = item;
      return acc;
    }, {});
  }
  return documents;
};

const hasVehicleCoreFields = (vehicle) => {
  const make = String(vehicle?.make || '').trim();
  const model = String(vehicle?.model || '').trim();
  const year = String(vehicle?.year || '').trim();
  const color = String(vehicle?.color || '').trim();
  const plate = String(vehicle?.plate || '').trim();
  const category = String(vehicle?.category || '').trim().toUpperCase();
  return (
    Boolean(make) &&
    Boolean(model) &&
    Boolean(year) &&
    Boolean(color) &&
    Boolean(plate) &&
    Object.prototype.hasOwnProperty.call(VEHICLE_CATEGORIES, category)
  );
};

const hasRequiredAgreements = (agreements) => {
  const termsAcceptedAt = toDate(agreements?.termsAcceptedAt);
  const safetyAcceptedAt = toDate(agreements?.safetyAcceptedAt);
  const commissionAcceptedAt = toDate(agreements?.commissionAcceptedAt);
  return Boolean(termsAcceptedAt && safetyAcceptedAt && commissionAcceptedAt);
};

const evaluateDriverEligibility = (snapshot = {}, options = {}) => {
  const now = options.now ? toDate(options.now) || new Date() : new Date();
  const backgroundCheckRequired = Boolean(options.backgroundCheckRequired);
  const driver = snapshot.driver || {};
  const documentsByType = normalizeDocumentMap(snapshot.documentsByType || snapshot.documents);
  const vehicle = snapshot.vehicle || {};
  const agreements = snapshot.agreements || {};
  const backgroundCheck = snapshot.backgroundCheck || {};

  const missingDocs = [];
  const notApprovedDocs = [];
  const rejectedOrExpiredDocs = [];

  for (const type of REQUIRED_DOCUMENT_TYPES) {
    const documentItem = documentsByType[type];
    const hasDocumentFile = Boolean(
      String(documentItem?.filePath || '').trim() ||
        String(documentItem?.downloadUrl || '').trim()
    );
    if (!hasDocumentFile) {
      missingDocs.push(type);
      continue;
    }

    const isExpired = isDateExpired(documentItem?.expiryDate, now);
    const rawStatus = String(documentItem?.status || DOCUMENT_STATUSES.PENDING).toUpperCase();
    const normalizedStatus = isExpired ? DOCUMENT_STATUSES.EXPIRED : rawStatus;

    if (normalizedStatus !== DOCUMENT_STATUSES.APPROVED) {
      notApprovedDocs.push(type);
      if (
        normalizedStatus === DOCUMENT_STATUSES.REJECTED ||
        normalizedStatus === DOCUMENT_STATUSES.EXPIRED
      ) {
        rejectedOrExpiredDocs.push(type);
      }
    }
  }

  const missingVehicle = !hasVehicleCoreFields(vehicle);
  const missingAgreements = !hasRequiredAgreements(agreements);
  const accountVerified = Boolean(driver?.accountVerified);

  const canSubmitForReview =
    accountVerified && missingDocs.length === 0 && !missingVehicle && !missingAgreements;

  const blockingReasons = [];
  if (!accountVerified) {
    blockingReasons.push('Account verification is incomplete.');
  }
  if (missingDocs.length > 0) {
    blockingReasons.push(`Missing required documents: ${missingDocs.join(', ')}.`);
  }
  if (missingVehicle) {
    blockingReasons.push('Vehicle details are incomplete.');
  }
  if (missingAgreements) {
    blockingReasons.push('Required agreements are not accepted.');
  }

  const driverStatus = String(driver?.status || DRIVER_STATUSES.UNVERIFIED).toUpperCase();
  const vehicleStatus = String(vehicle?.status || VEHICLE_STATUSES.PENDING).toUpperCase();
  const backgroundStatus = String(
    backgroundCheck?.status || BACKGROUND_CHECK_STATUSES.NOT_STARTED
  ).toUpperCase();

  let canGoOnline = true;
  if (driverStatus !== DRIVER_STATUSES.ACTIVE) {
    canGoOnline = false;
    blockingReasons.push('Driver account is not active.');
  }

  if (notApprovedDocs.length > 0) {
    canGoOnline = false;
    blockingReasons.push(`Documents not fully approved: ${notApprovedDocs.join(', ')}.`);
  }

  if (vehicleStatus !== VEHICLE_STATUSES.APPROVED) {
    canGoOnline = false;
    blockingReasons.push('Vehicle is not approved.');
  }

  if (backgroundCheckRequired && backgroundStatus !== BACKGROUND_CHECK_STATUSES.PASSED) {
    canGoOnline = false;
    blockingReasons.push('Background check has not passed.');
  }

  if (missingAgreements) {
    canGoOnline = false;
  }

  return {
    canSubmitForReview,
    canGoOnline,
    blockingReasons: Array.from(new Set(blockingReasons)),
    missingItems: {
      documents: missingDocs,
      vehicle: missingVehicle,
      agreements: missingAgreements,
      background:
        backgroundCheckRequired && backgroundStatus !== BACKGROUND_CHECK_STATUSES.PASSED,
      rejectedOrExpiredDocuments: rejectedOrExpiredDocs,
      notApprovedDocuments: notApprovedDocs,
    },
  };
};

module.exports = {
  DRIVER_STATUSES,
  ONBOARDING_STEPS,
  DOCUMENT_TYPES,
  REQUIRED_DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  VEHICLE_CATEGORIES,
  VEHICLE_STATUSES,
  BACKGROUND_CHECK_STATUSES,
  toDate,
  isDateExpired,
  evaluateDriverEligibility,
};

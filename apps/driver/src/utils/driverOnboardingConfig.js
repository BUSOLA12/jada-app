const parseBoolean = (value, fallback = false) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export const driverOnboardingConfig = Object.freeze({
  backgroundCheckRequired: parseBoolean(process.env.EXPO_PUBLIC_BACKGROUND_CHECK_REQUIRED, false),
  maxDocumentFileSizeBytes: 5 * 1024 * 1024,
  allowedDocumentMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
});

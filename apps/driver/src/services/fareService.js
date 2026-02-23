const DEFAULT_FUNCTIONS_REGION = 'us-central1';
const DEFAULT_PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'jada-app-29ba6';

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const getFunctionsBaseUrl = () => {
  const explicitBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL);
  if (explicitBaseUrl) return explicitBaseUrl;

  return `https://${DEFAULT_FUNCTIONS_REGION}-${DEFAULT_PROJECT_ID}.cloudfunctions.net`;
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const responseText = await response.text();
  let payload = {};

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      payload = { raw: responseText };
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || 'Fare estimate request failed.');
  }

  return payload;
};

const parseCoordinate = (coordinate, label) => {
  const lat = Number(coordinate?.lat ?? coordinate?.latitude);
  const lng = Number(coordinate?.lng ?? coordinate?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Missing valid ${label} coordinates.`);
  }

  return { lat, lng };
};

export const getFareEstimate = async ({ pickup, destination, options, currency = 'NGN', surgeMultiplier } = {}) => {
  const normalizedPickup = parseCoordinate(pickup, 'pickup');
  const normalizedDestination = parseCoordinate(destination, 'destination');
  const normalizedOptions = Array.isArray(options)
    ? options
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
    : undefined;
  const normalizedSurgeMultiplier = Number(surgeMultiplier);

  const body = {
    pickup: normalizedPickup,
    destination: normalizedDestination,
    currency: String(currency || 'NGN').toUpperCase(),
    options: normalizedOptions && normalizedOptions.length > 0 ? normalizedOptions : undefined,
    surgeMultiplier:
      Number.isFinite(normalizedSurgeMultiplier) && normalizedSurgeMultiplier > 0
        ? normalizedSurgeMultiplier
        : undefined,
  };

  const baseUrl = getFunctionsBaseUrl();
  return requestJson(`${baseUrl}/fareEstimate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

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
    throw new Error(payload?.error || payload?.message || 'Places request failed.');
  }

  return payload;
};

export const createPlacesSessionToken = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const autocompletePlaces = async ({
  input,
  sessionToken,
  locationBias,
  regionCode = 'NG',
}) => {
  const trimmedInput = String(input || '').trim();
  if (trimmedInput.length < 2) {
    return { predictions: [] };
  }

  const body = {
    input: trimmedInput,
    sessionToken: sessionToken || undefined,
    regionCode: regionCode || 'NG',
    locationBias:
      locationBias &&
      Number.isFinite(Number(locationBias.lat)) &&
      Number.isFinite(Number(locationBias.lng))
        ? {
            lat: Number(locationBias.lat),
            lng: Number(locationBias.lng),
            radiusMeters: Number(locationBias.radiusMeters || 30000),
          }
        : undefined,
  };

  const baseUrl = getFunctionsBaseUrl();
  const data = await requestJson(`${baseUrl}/placesAutocomplete`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    predictions: Array.isArray(data?.predictions) ? data.predictions : [],
  };
};

export const getPlaceDetails = async ({ placeId, sessionToken }) => {
  const normalizedPlaceId = String(placeId || '').trim();
  if (!normalizedPlaceId) {
    throw new Error('Missing placeId for place details lookup.');
  }

  const params = new URLSearchParams({
    placeId: normalizedPlaceId,
  });
  if (sessionToken) {
    params.append('sessionToken', sessionToken);
  }

  const baseUrl = getFunctionsBaseUrl();
  const data = await requestJson(`${baseUrl}/placeDetails?${params.toString()}`, {
    method: 'GET',
  });

  return data;
};

export const reverseGeocode = async ({ lat, lng }) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Missing valid lat/lng for reverse geocoding.');
  }

  const baseUrl = getFunctionsBaseUrl();
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });

  return requestJson(`${baseUrl}/reverseGeocode?${params.toString()}`, {
    method: 'GET',
  });
};

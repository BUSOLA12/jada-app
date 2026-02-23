const {onRequest} = require("firebase-functions/v2/https");

const FUNCTIONS_REGION = "us-central1";
const GOOGLE_ROUTES_API_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const DEFAULT_CURRENCY = "NGN";
const DEFAULT_SURGE_MULTIPLIER = 1;
const FARE_ROUNDING_STEP = 50;

const PRICING_TABLE = Object.freeze({
  economy: {
    base: 400,
    perKm: 120,
    perMin: 18,
    minFare: 800,
    bookingFee: 100,
  },
  comfort: {
    base: 600,
    perKm: 160,
    perMin: 22,
    minFare: 1200,
    bookingFee: 150,
  },
  xl: {
    base: 800,
    perKm: 220,
    perMin: 30,
    minFare: 1800,
    bookingFee: 200,
  },
  tricycle: {
    base: 250,
    perKm: 90,
    perMin: 14,
    minFare: 500,
    bookingFee: 80,
  },
});

const sendJson = (res, statusCode, payload) => {
  res.status(statusCode).json(payload);
};

const readErrorMessage = (payload, fallback) => {
  if (payload?.error?.message) {
    return payload.error.message;
  }
  if (payload?.message) {
    return payload.message;
  }
  return fallback;
};

const getApiKey = () =>
  String(
      process.env.GOOGLE_ROUTES_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      "",
  ).trim();

const parseCoordinate = (value) => {
  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {lat, lng};
};

const parseDurationSeconds = (durationValue) => {
  const durationText = String(durationValue || "").trim();
  const match = durationText.match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
  if (!match) {
    return null;
  }

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds)) {
    return null;
  }

  return Math.max(0, Math.round(seconds));
};

const roundToNearestStep = (value, step) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value / step) * step;
};

const formatNaira = (value) => {
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch (error) {
    return `NGN ${Math.round(amount).toLocaleString("en-NG")}`;
  }
};

const sanitizeRequestedOptions = (options) => {
  const defaultIds = Object.keys(PRICING_TABLE);
  if (!Array.isArray(options) || options.length === 0) {
    return defaultIds;
  }

  const seen = new Set();
  const validIds = [];

  for (const item of options) {
    const id = String(item || "").trim().toLowerCase();
    if (!id || !PRICING_TABLE[id] || seen.has(id)) {
      continue;
    }
    seen.add(id);
    validIds.push(id);
  }

  return validIds.length > 0 ? validIds : defaultIds;
};

const buildEstimate = ({
  id,
  distanceMeters,
  durationSeconds,
  surgeMultiplier,
}) => {
  const config = PRICING_TABLE[id];
  if (!config) {
    return null;
  }

  const km = distanceMeters / 1000;
  const mins = durationSeconds / 60;
  const rawFare =
    config.base +
    config.perKm * km +
    config.perMin * mins +
    config.bookingFee;
  const surgedFare = rawFare * surgeMultiplier;
  const roundedFare = roundToNearestStep(surgedFare, FARE_ROUNDING_STEP);
  const finalFare = Math.max(config.minFare, roundedFare);

  return {
    id,
    fare: finalFare,
    formatted: formatNaira(finalFare),
  };
};

const fareEstimate = onRequest(
    {
      region: FUNCTIONS_REGION,
      cors: true,
      secrets: ["GOOGLE_ROUTES_API_KEY", "GOOGLE_PLACES_API_KEY"],
    },
    async (req, res) => {
      if (req.method !== "POST") {
        return sendJson(res, 405, {error: "Method not allowed"});
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 500, {
          error:
            "Missing GOOGLE_ROUTES_API_KEY/GOOGLE_PLACES_API_KEY " +
            "in Functions environment.",
        });
      }

      const pickup = parseCoordinate(req.body?.pickup);
      const destination = parseCoordinate(req.body?.destination);
      if (!pickup || !destination) {
        return sendJson(res, 400, {
          error:
            "Invalid pickup/destination coordinates. " +
            "Expected { lat, lng }.",
        });
      }

      const requestedSurge = Number(req.body?.surgeMultiplier);
      const surgeMultiplier =
        Number.isFinite(requestedSurge) && requestedSurge > 0 ?
          requestedSurge :
          DEFAULT_SURGE_MULTIPLIER;
      const requestedCurrency = String(
          req.body?.currency || DEFAULT_CURRENCY,
      ).toUpperCase();
      const currency = requestedCurrency === "NGN" ?
        "NGN" :
        DEFAULT_CURRENCY;
      const optionIds = sanitizeRequestedOptions(req.body?.options);

      const routesRequestBody = {
        origin: {
          location: {
            latLng: {
              latitude: pickup.lat,
              longitude: pickup.lng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
      };

      try {
        const routesResponse = await fetch(GOOGLE_ROUTES_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
          },
          body: JSON.stringify(routesRequestBody),
        });

        const routesPayload = await routesResponse.json().catch(() => ({}));
        if (!routesResponse.ok) {
          return sendJson(res, routesResponse.status, {
            error: readErrorMessage(
                routesPayload,
                "Google Routes request failed.",
            ),
          });
        }

        const route = Array.isArray(routesPayload?.routes) ?
          routesPayload.routes[0] :
          null;
        const distanceMeters = Number(route?.distanceMeters);
        const durationSeconds = parseDurationSeconds(route?.duration);

        if (
          !Number.isFinite(distanceMeters) ||
          !Number.isFinite(durationSeconds)
        ) {
          return sendJson(res, 422, {
            error: "Google Routes response missing distanceMeters/duration.",
          });
        }

        const estimates = optionIds
            .map((id) =>
              buildEstimate({
                id,
                distanceMeters,
                durationSeconds,
                surgeMultiplier,
              }),
            )
            .filter(Boolean);

        return sendJson(res, 200, {
          distanceMeters: Math.round(distanceMeters),
          durationSeconds,
          currency,
          surgeMultiplier,
          estimates,
        });
      } catch (error) {
        return sendJson(res, 500, {
          error:
            error?.message ||
            "Unexpected server error while estimating fare.",
        });
      }
    },
);

module.exports = {
  fareEstimate,
};

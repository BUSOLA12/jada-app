const {onRequest} = require("firebase-functions/v2/https");

const GOOGLE_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_PLACE_DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";
const GOOGLE_REVERSE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const FUNCTIONS_REGION = "us-central1";
const PLUS_CODE_PATTERN = /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,}/i;

const sendJson = (res, statusCode, payload) => {
  res.status(statusCode).json(payload);
};

const getApiKey = () => String(process.env.GOOGLE_PLACES_API_KEY || "").trim();

const readErrorMessage = (payload, fallback) => {
  if (payload?.error?.message) {
    return payload.error.message;
  }
  if (payload?.message) {
    return payload.message;
  }
  return fallback;
};

const mapAutocompletePrediction = (prediction) => {
  const structured = prediction?.structuredFormat || {};
  const primaryText = structured?.mainText?.text ||
    prediction?.text?.text ||
    prediction?.displayName?.text ||
    "";
  const secondaryText = structured?.secondaryText?.text || "";

  return {
    placeId: prediction?.placeId || "",
    primaryText,
    secondaryText,
  };
};

const parseLocation = (location) => {
  const latitude = Number(location?.latitude ?? location?.lat);
  const longitude = Number(location?.longitude ?? location?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {lat: latitude, lng: longitude};
};

const isPlusCodeLike = (text) => {
  const value = String(text || "").trim();
  if (!value) {
    return false;
  }

  if (/plus code/i.test(value)) {
    return true;
  }

  return PLUS_CODE_PATTERN.test(value);
};

const getAddressComponent = (components, types) => {
  const list = Array.isArray(components) ? components : [];
  const allowedTypes = new Set(types);
  const match = list.find((component) => {
    if (!Array.isArray(component?.types)) {
      return false;
    }
    return component.types.some((type) => allowedTypes.has(type));
  });

  return String(match?.long_name || "").trim();
};

const joinUniqueAddressParts = (parts) => {
  const seen = new Set();
  return parts
      .map((part) => String(part || "").trim())
      .filter((part) => part && !isPlusCodeLike(part))
      .filter((part) => {
        const key = part.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
};

const buildReverseGeocodeCandidate = (result) => {
  const formattedAddress = String(result?.formatted_address || "").trim();
  if (!formattedAddress || isPlusCodeLike(formattedAddress)) {
    return null;
  }

  const components = Array.isArray(result?.address_components) ?
    result.address_components :
    [];
  const streetNumber = getAddressComponent(components, ["street_number"]);
  const route = getAddressComponent(components, ["route"]);
  const neighborhood = getAddressComponent(components, [
    "neighborhood",
    "sublocality",
    "sublocality_level_1",
    "sublocality_level_2",
    "sublocality_level_3",
    "sublocality_level_4",
    "sublocality_level_5",
  ]);
  const locality = getAddressComponent(components, [
    "locality",
    "postal_town",
    "administrative_area_level_3",
  ]);
  const administrativeArea = getAddressComponent(
      components,
      ["administrative_area_level_1"],
  );
  const country = getAddressComponent(components, ["country"]);

  let rank = 0;
  let primaryText = "";
  if (streetNumber && route) {
    rank = 6;
    primaryText = `${streetNumber} ${route}`;
  } else if (route) {
    rank = 5;
    primaryText = route;
  } else if (neighborhood) {
    rank = 4;
    primaryText = neighborhood;
  } else if (locality) {
    rank = 3;
    primaryText = locality;
  } else if (administrativeArea) {
    rank = 2;
    primaryText = administrativeArea;
  } else if (country) {
    rank = 1;
    primaryText = country;
  }

  if (!primaryText || isPlusCodeLike(primaryText)) {
    return null;
  }

  let secondaryParts = [];
  if (rank >= 5) {
    secondaryParts = joinUniqueAddressParts([
      neighborhood || locality,
      administrativeArea,
    ]);
  } else if (rank === 4) {
    secondaryParts = joinUniqueAddressParts([locality, administrativeArea]);
  } else if (rank === 3) {
    secondaryParts = joinUniqueAddressParts([administrativeArea]);
  } else if (rank === 2) {
    secondaryParts = joinUniqueAddressParts([country]);
  }

  const primaryKey = primaryText.toLowerCase();
  const secondaryText = secondaryParts
      .filter((part) => part.toLowerCase() !== primaryKey)
      .join(", ");

  return {
    rank,
    formattedAddress,
    primaryText,
    secondaryText,
  };
};

const pickBestReverseGeocodeLabel = (results) => {
  const list = Array.isArray(results) ? results : [];
  let bestCandidate = null;

  for (const result of list) {
    const candidate = buildReverseGeocodeCandidate(result);
    if (!candidate) {
      continue;
    }

    if (!bestCandidate || candidate.rank > bestCandidate.rank) {
      bestCandidate = candidate;
    }

    if (candidate.rank === 6) {
      break;
    }
  }

  if (!bestCandidate) {
    return {
      formattedAddress: "",
      primaryText: "",
      secondaryText: "",
    };
  }

  return {
    formattedAddress: bestCandidate.formattedAddress,
    primaryText: bestCandidate.primaryText,
    secondaryText: bestCandidate.secondaryText,
  };
};

const placesAutocomplete = onRequest(
    {region: FUNCTIONS_REGION, cors: true, secrets: ["GOOGLE_PLACES_API_KEY"]},
    async (req, res) => {
      if (req.method !== "POST") {
        return sendJson(res, 405, {error: "Method not allowed"});
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 500, {
          error: "Missing GOOGLE_PLACES_API_KEY in Functions environment.",
        });
      }

      const input = String(req.body?.input || "").trim();
      if (input.length < 2) {
        return sendJson(res, 200, {predictions: []});
      }

      const locationBias = req.body?.locationBias;
      const requestBody = {
        input,
        sessionToken: req.body?.sessionToken || undefined,
        regionCode: String(req.body?.regionCode || "NG").toUpperCase(),
      };

      if (
        Number.isFinite(Number(locationBias?.lat)) &&
    Number.isFinite(Number(locationBias?.lng))
      ) {
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: Number(locationBias.lat),
              longitude: Number(locationBias.lng),
            },
            radius: Number(locationBias.radiusMeters || 30000),
          },
        };
      }

      try {
        const googleResponse = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId," +
          "suggestions.placePrediction.structuredFormat",
          },
          body: JSON.stringify(requestBody),
        });

        const googlePayload = await googleResponse.json().catch(() => ({}));

        if (!googleResponse.ok) {
          return sendJson(res, googleResponse.status, {
            error: readErrorMessage(
                googlePayload,
                "Google autocomplete request failed.",
            ),
          });
        }

        const predictions = (googlePayload?.suggestions || [])
            .map((item) => mapAutocompletePrediction(item?.placePrediction))
            .filter((item) => item.placeId && item.primaryText);

        return sendJson(res, 200, {predictions});
      } catch (error) {
        return sendJson(res, 500, {
          error: error?.message ||
        "Unexpected server error while searching places.",
        });
      }
    });

const placeDetails = onRequest(
    {region: FUNCTIONS_REGION, cors: true, secrets: ["GOOGLE_PLACES_API_KEY"]},
    async (req, res) => {
      if (req.method !== "GET") {
        return sendJson(res, 405, {error: "Method not allowed"});
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 500, {
          error: "Missing GOOGLE_PLACES_API_KEY in Functions environment.",
        });
      }

      const placeId = String(req.query?.placeId || "").trim();
      if (!placeId) {
        return sendJson(res, 400, {error: "Missing placeId query parameter."});
      }

      const sessionToken = String(req.query?.sessionToken || "").trim();
      const query = new URLSearchParams();
      if (sessionToken) {
        query.append("sessionToken", sessionToken);
      }
      const queryString = query.toString();
      const endpoint = `${GOOGLE_PLACE_DETAILS_BASE_URL}` +
  `/${encodeURIComponent(placeId)}${
    queryString ? `?${queryString}` : ""
  }`;

      try {
        const googleResponse = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
          },
        });

        const googlePayload = await googleResponse.json().catch(() => ({}));

        if (!googleResponse.ok) {
          return sendJson(res, googleResponse.status, {
            error: readErrorMessage(
                googlePayload,
                "Google place details request failed.",
            ),
          });
        }

        const location = parseLocation(googlePayload?.location);
        if (!location) {
          return sendJson(res, 422, {
            error: "Google place details missing location coordinates.",
          });
        }

        return sendJson(res, 200, {
          placeId: googlePayload?.id || placeId,
          name: googlePayload?.displayName?.text || "",
          address: googlePayload?.formattedAddress || "",
          lat: location.lat,
          lng: location.lng,
        });
      } catch (error) {
        return sendJson(res, 500, {
          error: error?.message ||
        "Unexpected server error while getting place details.",
        });
      }
    });

const reverseGeocode = onRequest(
    {region: FUNCTIONS_REGION, cors: true, secrets: ["GOOGLE_PLACES_API_KEY"]},
    async (req, res) => {
      if (req.method !== "GET") {
        return sendJson(res, 405, {error: "Method not allowed"});
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        return sendJson(res, 500, {
          error: "Missing GOOGLE_PLACES_API_KEY in Functions environment.",
        });
      }

      const lat = Number(req.query?.lat);
      const lng = Number(req.query?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return sendJson(res, 400, {
          error: "Invalid lat/lng query parameters.",
        });
      }

      const endpoint =
        `${GOOGLE_REVERSE_GEOCODE_URL}?latlng=${lat},${lng}` +
        `&key=${encodeURIComponent(apiKey)}`;

      try {
        const googleResponse = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const googlePayload = await googleResponse.json().catch(() => ({}));
        if (!googleResponse.ok) {
          return sendJson(res, googleResponse.status, {
            error: readErrorMessage(
                googlePayload,
                "Google reverse geocode request failed.",
            ),
          });
        }

        const status = String(googlePayload?.status || "").toUpperCase();
        if (status === "ZERO_RESULTS") {
          return sendJson(res, 200, {
            lat,
            lng,
            formattedAddress: "",
            primaryText: "",
            secondaryText: "",
          });
        }

        if (status !== "OK") {
          return sendJson(res, 502, {
            error:
              googlePayload?.error_message ||
              `Google reverse geocode failed with status: ${
                status || "UNKNOWN"
              }`,
          });
        }

        const bestLabel = pickBestReverseGeocodeLabel(googlePayload?.results);

        return sendJson(res, 200, {
          lat,
          lng,
          formattedAddress: bestLabel.formattedAddress,
          primaryText: bestLabel.primaryText,
          secondaryText: bestLabel.secondaryText,
        });
      } catch (error) {
        return sendJson(res, 500, {
          error: error?.message ||
            "Unexpected server error while reverse geocoding.",
        });
      }
    },
);

module.exports = {
  placesAutocomplete,
  placeDetails,
  reverseGeocode,
};

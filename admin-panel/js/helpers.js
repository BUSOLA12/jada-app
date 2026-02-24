export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  let date;
  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else {
    date = new Date(value);
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

export const statusBadgeClass = (status) =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

export const statusBadgeHtml = (status) => {
  const normalized = String(status || "UNKNOWN").trim().toUpperCase();
  const cssClass = statusBadgeClass(normalized);
  return `<span class="badge ${cssClass}">${escapeHtml(normalized)}</span>`;
};

export const requiredDocumentTypes = [
  "LICENSE",
  "GOV_ID",
  "PROFILE_PHOTO",
  "VEHICLE_REG",
  "INSURANCE",
  "ROADWORTHINESS",
];

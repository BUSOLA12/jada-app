import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getDownloadURL,
  ref,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import { db, storage } from "./firebase-client.js";
import { requireAdmin, setSignedInEmail } from "./auth.js";
import { initNav } from "./nav.js";
import { startButtonLoading } from "./buttonLoading.js";
import {
  escapeHtml,
  formatDateTime,
  requiredDocumentTypes,
  statusBadgeHtml,
} from "./helpers.js";

const uid = new URLSearchParams(window.location.search).get("id");
const pageError = document.getElementById("detail-error");
const saveStatusBtn = document.getElementById("set-driver-status-btn");
const saveBackgroundBtn = document.getElementById("set-background-btn");
const approveVehicleBtn = document.getElementById("approve-vehicle-btn");
const rejectVehicleBtn = document.getElementById("reject-vehicle-btn");

const showError = (message) => {
  if (!pageError) {
    return;
  }

  pageError.classList.remove("hidden");
  pageError.textContent = message;
};

const hideError = () => {
  if (!pageError) {
    return;
  }

  pageError.classList.add("hidden");
  pageError.textContent = "";
};

const getStatusValue = (value) => String(value || "").trim().toUpperCase();

const getPreviewUrl = async (documentData) => {
  if (documentData?.downloadUrl) {
    return documentData.downloadUrl;
  }

  const filePath = String(documentData?.filePath || "").trim();
  if (!filePath) {
    return "";
  }

  return getDownloadURL(ref(storage, filePath));
};

const updateDriverHeader = (driverData) => {
  const heading = document.getElementById("driver-heading");
  const statusSlot = document.getElementById("driver-status-badge");
  const profileSlot = document.getElementById("driver-profile");

  heading.textContent = `Driver ${uid}`;
  statusSlot.innerHTML = statusBadgeHtml(driverData?.status || "UNVERIFIED");

  profileSlot.innerHTML = `
    <div class="stack">
      <div><strong>Full name:</strong> ${escapeHtml(driverData?.fullName || "-")}</div>
      <div><strong>Phone:</strong> ${escapeHtml(driverData?.phone || "-")}</div>
      <div><strong>Email:</strong> ${escapeHtml(driverData?.email || "-")}</div>
      <div><strong>Date of birth:</strong> ${escapeHtml(driverData?.dob || "-")}</div>
      <div><strong>Account verified:</strong> ${driverData?.accountVerified ? "Yes" : "No"}</div>
      <div><strong>Onboarding step:</strong> ${escapeHtml(driverData?.onboardingStep || "-")}</div>
      <div><strong>Created:</strong> ${escapeHtml(formatDateTime(driverData?.createdAt))}</div>
      <div><strong>Updated:</strong> ${escapeHtml(formatDateTime(driverData?.updatedAt))}</div>
    </div>
  `;

  const statusSelect = document.getElementById("driver-status-select");
  statusSelect.value = getStatusValue(driverData?.status || "UNVERIFIED");
};

const updateVehicleSection = (vehicleData) => {
  const status = getStatusValue(vehicleData?.status || "PENDING");
  const vehicleInfo = document.getElementById("vehicle-info");
  const vehicleStatusBadge = document.getElementById("vehicle-status-badge");

  vehicleStatusBadge.innerHTML = statusBadgeHtml(status);
  vehicleInfo.innerHTML = `
    <div class="stack">
      <div><strong>Make:</strong> ${escapeHtml(vehicleData?.make || "-")}</div>
      <div><strong>Model:</strong> ${escapeHtml(vehicleData?.model || "-")}</div>
      <div><strong>Year:</strong> ${escapeHtml(vehicleData?.year || "-")}</div>
      <div><strong>Color:</strong> ${escapeHtml(vehicleData?.color || "-")}</div>
      <div><strong>Plate:</strong> ${escapeHtml(vehicleData?.plate || "-")}</div>
      <div><strong>Category:</strong> ${escapeHtml(vehicleData?.category || "-")}</div>
    </div>
  `;

  approveVehicleBtn.disabled = status === "APPROVED";
};

const updateBackgroundSection = (backgroundData) => {
  const status = getStatusValue(backgroundData?.status || "NOT_STARTED");
  const backgroundStatusBadge = document.getElementById("background-status-badge");
  const backgroundSelect = document.getElementById("background-status-select");

  backgroundStatusBadge.innerHTML = statusBadgeHtml(status);
  backgroundSelect.value = status;
};

const renderDocuments = async (documentMap) => {
  const docsContainer = document.getElementById("documents-grid");
  docsContainer.innerHTML = "";

  for (const type of requiredDocumentTypes) {
    const data = documentMap[type] || { type, status: "PENDING" };
    const status = getStatusValue(data.status || "PENDING");

    let previewUrl = "";
    try {
      previewUrl = await getPreviewUrl(data);
    } catch (error) {
      previewUrl = "";
    }

    const card = document.createElement("div");
    card.className = "doc-card";
    card.innerHTML = `
      <h3>${escapeHtml(type)}</h3>
      <div style="margin-top:6px">${statusBadgeHtml(status)}</div>
      <div class="muted" style="margin-top:6px">Generated ID: ${escapeHtml(data.generatedId || "-")}</div>
      <div class="muted" style="margin-top:6px">Document number: ${escapeHtml(data.documentNumber || "-")}</div>
      <div class="muted">Expiry: ${escapeHtml(data.expiryDate || "-")}</div>
      <div class="muted">Submitted: ${escapeHtml(formatDateTime(data.submittedAt))}</div>
      <div class="muted">Reviewed: ${escapeHtml(formatDateTime(data.reviewedAt))}</div>
      ${data.rejectionReason ? `<div class="error-box" style="margin-top:8px">${escapeHtml(data.rejectionReason)}</div>` : ""}
      ${previewUrl ? `<div style="margin-top:8px"><a class="preview-link" target="_blank" rel="noreferrer" href="${escapeHtml(previewUrl)}">Open file</a></div>` : ""}
      <div class="doc-actions">
        <button class="btn-primary" data-doc-action="approve" data-doc-type="${escapeHtml(type)}">Approve</button>
        <button class="btn-danger" data-doc-action="reject" data-doc-type="${escapeHtml(type)}">Reject</button>
      </div>
    `;

    docsContainer.appendChild(card);
  }
};

const loadAll = async () => {
  hideError();

  const driverRef = doc(db, "drivers", uid);
  const vehicleRef = doc(db, "drivers", uid, "vehicle", "current");
  const backgroundRef = doc(db, "drivers", uid, "backgroundCheck", "current");
  const documentsRef = collection(db, "drivers", uid, "documents");

  const [driverSnap, vehicleSnap, backgroundSnap, documentsSnap] = await Promise.all([
    getDoc(driverRef),
    getDoc(vehicleRef),
    getDoc(backgroundRef),
    getDocs(documentsRef),
  ]);

  if (!driverSnap.exists()) {
    throw new Error("Driver record not found.");
  }

  const driverData = driverSnap.data() || {};
  const vehicleData = vehicleSnap.exists() ? vehicleSnap.data() : {};
  const backgroundData = backgroundSnap.exists() ? backgroundSnap.data() : {};
  const documentMap = {};

  documentsSnap.forEach((documentSnapshot) => {
    const data = documentSnapshot.data() || {};
    const type = getStatusValue(data.type || documentSnapshot.id);
    documentMap[type] = data;
  });

  updateDriverHeader(driverData);
  updateVehicleSection(vehicleData);
  updateBackgroundSection(backgroundData);
  await renderDocuments(documentMap);
};

const setDriverStatus = async () => {
  const select = document.getElementById("driver-status-select");
  const nextStatus = getStatusValue(select.value);

  await updateDoc(doc(db, "drivers", uid), {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });
  await loadAll();
};

const setBackgroundStatus = async () => {
  const select = document.getElementById("background-status-select");
  const nextStatus = getStatusValue(select.value);

  await setDoc(
    doc(db, "drivers", uid, "backgroundCheck", "current"),
    {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await loadAll();
};

const setVehicleStatus = async (status, rejectionReason = "") => {
  const payload = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "REJECTED") {
    payload.rejectionReason = String(rejectionReason || "").trim() || null;
  } else {
    payload.rejectionReason = null;
  }

  await setDoc(
    doc(db, "drivers", uid, "vehicle", "current"),
    payload,
    { merge: true }
  );

  if (status === "REJECTED") {
    await setDoc(
      doc(db, "drivers", uid),
      {
        status: "REJECTED",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await loadAll();
};

const setDocumentStatus = async (type, status) => {
  const docRef = doc(db, "drivers", uid, "documents", type);

  if (status === "APPROVED") {
    await setDoc(
      docRef,
      {
        status: "APPROVED",
        rejectionReason: null,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  const rejectionReason = window.prompt(`Enter rejection reason for ${type}:`);
  if (!rejectionReason) {
    return;
  }

  await setDoc(
    docRef,
    {
      status: "REJECTED",
      rejectionReason: rejectionReason.trim(),
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "drivers", uid),
    {
      status: "REJECTED",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const attachListeners = () => {
  saveStatusBtn.addEventListener("click", async () => {
    hideError();
    const stopLoading = startButtonLoading(saveStatusBtn, "Saving...");
    try {
      await setDriverStatus();
    } catch (error) {
      showError(error?.message || "Unable to update driver status.");
    } finally {
      stopLoading();
    }
  });

  saveBackgroundBtn.addEventListener("click", async () => {
    hideError();
    const stopLoading = startButtonLoading(saveBackgroundBtn, "Saving...");
    try {
      await setBackgroundStatus();
    } catch (error) {
      showError(error?.message || "Unable to update background status.");
    } finally {
      stopLoading();
    }
  });

  approveVehicleBtn.addEventListener("click", async () => {
    hideError();
    const stopLoading = startButtonLoading(approveVehicleBtn, "Approving...");
    try {
      await setVehicleStatus("APPROVED");
    } catch (error) {
      showError(error?.message || "Unable to approve vehicle.");
    } finally {
      stopLoading();
    }
  });

  rejectVehicleBtn.addEventListener("click", async () => {
    const reason = window.prompt("Optional reason for vehicle rejection:");
    if (reason === null) {
      return;
    }
    hideError();
    const stopLoading = startButtonLoading(rejectVehicleBtn, "Rejecting...");
    try {
      await setVehicleStatus("REJECTED", reason);
    } catch (error) {
      showError(error?.message || "Unable to reject vehicle.");
    } finally {
      stopLoading();
    }
  });

  document.getElementById("documents-grid").addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = target.dataset.docAction;
    const type = target.dataset.docType;
    if (!action || !type) {
      return;
    }

    const stopLoading = startButtonLoading(
      target,
      action === "approve" ? "Approving..." : "Rejecting..."
    );
    hideError();
    try {
      if (action === "approve") {
        await setDocumentStatus(type, "APPROVED");
      } else if (action === "reject") {
        await setDocumentStatus(type, "REJECTED");
      }

      await loadAll();
    } catch (error) {
      showError(error?.message || "Unable to update document status.");
    } finally {
      stopLoading();
    }
  });
};

const bootstrap = async () => {
  const user = await requireAdmin();
  if (!user) {
    return;
  }

  if (!uid) {
    throw new Error("Missing driver id in URL.");
  }

  setSignedInEmail("signed-in-email", user);
  initNav("drivers");
  attachListeners();
  await loadAll();
};

bootstrap().catch((error) => {
  showError(error?.message || "Failed to load driver details.");
});

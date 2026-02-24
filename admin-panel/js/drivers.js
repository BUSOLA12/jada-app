import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-client.js";
import { requireAdmin, setSignedInEmail } from "./auth.js";
import { initNav } from "./nav.js";
import { escapeHtml, formatDateTime, statusBadgeHtml } from "./helpers.js";

const statusFilter = document.getElementById("status-filter");
const tableBody = document.getElementById("drivers-table-body");
const loadingLabel = document.getElementById("drivers-loading");

const buildDriverRow = (uid, data) => {
  const fullName = data.fullName || "-";
  const email = data.email || "-";
  const phone = data.phone || "-";
  const statusHtml = statusBadgeHtml(data.status || "UNVERIFIED");
  const createdAt = formatDateTime(data.createdAt);

  return `
    <tr>
      <td><a href="./driver-detail.html?id=${encodeURIComponent(uid)}">${escapeHtml(uid)}</a></td>
      <td>${escapeHtml(fullName)}</td>
      <td>${escapeHtml(email)}</td>
      <td>${escapeHtml(phone)}</td>
      <td>${statusHtml}</td>
      <td>${escapeHtml(createdAt)}</td>
      <td><a class="btn-outline" href="./driver-detail.html?id=${encodeURIComponent(uid)}">Open</a></td>
    </tr>
  `;
};

const loadDrivers = async () => {
  loadingLabel.classList.remove("hidden");
  tableBody.innerHTML = "";

  const selectedStatus = String(statusFilter.value || "").trim().toUpperCase();
  let snapshot;

  if (!selectedStatus) {
    snapshot = await getDocs(collection(db, "drivers"));
  } else {
    snapshot = await getDocs(
      query(collection(db, "drivers"), where("status", "==", selectedStatus))
    );
  }

  if (snapshot.empty) {
    tableBody.innerHTML = `<tr><td colspan="7" class="muted">No drivers found.</td></tr>`;
    loadingLabel.classList.add("hidden");
    return;
  }

  const rows = [];
  const list = [];
  snapshot.forEach((documentSnapshot) => {
    list.push({ id: documentSnapshot.id, data: documentSnapshot.data() || {} });
  });

  list.sort((left, right) => {
    const leftDate = left.data?.createdAt?.toDate?.() || new Date(0);
    const rightDate = right.data?.createdAt?.toDate?.() || new Date(0);
    return rightDate.getTime() - leftDate.getTime();
  });

  list.forEach((item) => {
    rows.push(buildDriverRow(item.id, item.data));
  });

  tableBody.innerHTML = rows.join("\n");
  loadingLabel.classList.add("hidden");
};

const bootstrap = async () => {
  const user = await requireAdmin();
  if (!user) {
    return;
  }

  setSignedInEmail("signed-in-email", user);
  initNav("drivers");
  await loadDrivers();

  statusFilter.addEventListener("change", () => {
    loadDrivers().catch((error) => {
      const errorBox = document.getElementById("drivers-error");
      if (errorBox) {
        errorBox.classList.remove("hidden");
        errorBox.textContent = error?.message || "Failed to load drivers.";
      }
    });
  });
};

bootstrap().catch((error) => {
  const errorBox = document.getElementById("drivers-error");
  if (errorBox) {
    errorBox.classList.remove("hidden");
    errorBox.textContent = error?.message || "Failed to load drivers.";
  }
});

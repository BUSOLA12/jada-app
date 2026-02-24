import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-client.js";
import { requireAdmin, setSignedInEmail } from "./auth.js";
import { initNav } from "./nav.js";

const metrics = {
  total: document.getElementById("metric-total"),
  pending: document.getElementById("metric-pending"),
  active: document.getElementById("metric-active"),
  rejected: document.getElementById("metric-rejected"),
};

const loadDashboard = async () => {
  const user = await requireAdmin();
  if (!user) {
    return;
  }

  setSignedInEmail("signed-in-email", user);
  initNav("dashboard");

  const driversSnapshot = await getDocs(collection(db, "drivers"));
  const counts = {
    total: 0,
    pending: 0,
    active: 0,
    rejected: 0,
  };

  driversSnapshot.forEach((documentSnapshot) => {
    const data = documentSnapshot.data() || {};
    const status = String(data.status || "UNVERIFIED").toUpperCase();

    counts.total += 1;
    if (status === "PENDING_REVIEW") {
      counts.pending += 1;
    }
    if (status === "ACTIVE") {
      counts.active += 1;
    }
    if (status === "REJECTED") {
      counts.rejected += 1;
    }
  });

  metrics.total.textContent = String(counts.total);
  metrics.pending.textContent = String(counts.pending);
  metrics.active.textContent = String(counts.active);
  metrics.rejected.textContent = String(counts.rejected);
};

loadDashboard().catch((error) => {
  const errorBox = document.getElementById("dashboard-error");
  if (errorBox) {
    errorBox.classList.remove("hidden");
    errorBox.textContent = error?.message || "Failed to load dashboard.";
  }
});

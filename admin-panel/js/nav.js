import { logoutAdmin } from "./auth.js";
import { startButtonLoading } from "./buttonLoading.js";

export const initNav = (activePage) => {
  const activeLink = document.querySelector(`[data-nav="${activePage}"]`);
  if (activeLink) {
    activeLink.classList.add("active");
  }

  const logoutButton = document.getElementById("logout-btn");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      const stopLoading = startButtonLoading(logoutButton, "Logging out...");
      try {
        await logoutAdmin();
      } finally {
        stopLoading();
      }
    });
  }
};

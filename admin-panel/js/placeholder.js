import { requireAdmin, setSignedInEmail } from "./auth.js";
import { initNav } from "./nav.js";

const page = String(document.body.dataset.page || "");

const bootstrap = async () => {
  const user = await requireAdmin();
  if (!user) {
    return;
  }

  setSignedInEmail("signed-in-email", user);
  initNav(page);
};

bootstrap();

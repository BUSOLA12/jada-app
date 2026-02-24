import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth } from "./firebase-client.js";

const waitForAuthUser = () =>
  new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });

export const loginAdmin = async (email, password) => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const tokenResult = await credential.user.getIdTokenResult(true);

  if (tokenResult?.claims?.admin !== true) {
    await signOut(auth);
    throw new Error("Your account is authenticated but does not have admin privileges.");
  }

  return credential.user;
};

export const requireAdmin = async () => {
  const user = await waitForAuthUser();
  if (!user) {
    window.location.href = "./login.html";
    return null;
  }

  const tokenResult = await user.getIdTokenResult(true);
  if (tokenResult?.claims?.admin !== true) {
    await signOut(auth);
    window.location.href = "./login.html";
    return null;
  }

  return user;
};

export const logoutAdmin = async () => {
  await signOut(auth);
  window.location.href = "./login.html";
};

export const setSignedInEmail = (elementId, user) => {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = user?.email || "";
};

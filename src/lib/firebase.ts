import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyACo9VakiNymvhhzgSZ0jFvVPSTfAgmdTM",
  authDomain: "eugeniofuenzalidaps.firebaseapp.com",
  projectId: "eugeniofuenzalidaps",
  storageBucket: "eugeniofuenzalidaps.firebasestorage.app",
  messagingSenderId: "153097732814",
  appId: "1:153097732814:web:757f723336ae187492069f",
  measurementId: "G-N2Y9RSPVZ8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage, app };

let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}
export { analytics };

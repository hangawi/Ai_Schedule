// Firebase configuration for client-side authentication
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCPnP6VeECcYP5IcFmwjvc_Tum9tHZYz18",
  authDomain: "ai-schedule-23cb8.firebaseapp.com",
  projectId: "ai-schedule-23cb8",
  storageBucket: "ai-schedule-23cb8.firebasestorage.app",
  messagingSenderId: "883727972092",
  appId: "1:883727972092:web:30963d897ebcc335730979",
  measurementId: "G-J8H11WCKYV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app;

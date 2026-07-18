import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB2oyY7MByQf55egA-b0bfTRNOxw1iCCvM",
  authDomain: "ipltest-141e7.firebaseapp.com",
  databaseURL: "https://ipltest-141e7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ipltest-141e7",
  storageBucket: "ipltest-141e7.firebasestorage.app",
  messagingSenderId: "1023672806310",
  appId: "1:1023672806310:web:95634b593b2fa57facfd67",
  measurementId: "G-TJ108WRLDF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const db = getDatabase(app);

// Initialize Firebase Auth
export const auth = getAuth(app);

export default app;

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAsHPLrNoCpgTy1dhDciXvoUCiUZXr00aU",
  authDomain: "csskins-73bf6.firebaseapp.com",
  projectId: "csskins-73bf6",
  storageBucket: "csskins-73bf6.firebasestorage.app",
  messagingSenderId: "661332295668",
  appId: "1:661332295668:web:164410f30252dd602983a1",
  measurementId: "G-RTLLC3ZHKX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);  

const analytics = getAnalytics(app);

export { db };
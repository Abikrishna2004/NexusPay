import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBy1qJ2sBIp1A4VNPYTySJTfFsAIzz1OF0",
  authDomain: "nexuspay-29521.firebaseapp.com",
  projectId: "nexuspay-29521",
  storageBucket: "nexuspay-29521.firebasestorage.app",
  messagingSenderId: "1090400468714",
  appId: "1:1090400468714:web:be925d9ff94b005bf42193",
  measurementId: "G-361QKHPKDX"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };

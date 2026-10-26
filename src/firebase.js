import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBF64dO3FmiJEp7wO4vUQmHVBNUNcOULGc",
  authDomain: "adsplus-user-app.firebaseapp.com",
  projectId: "adsplus-user-app",
  storageBucket: "adsplus-user-app.firebasestorage.app",
  messagingSenderId: "918151839730",
  appId: "1:918151839730:web:2e808bfa5457155067f56b",
  measurementId: "G-BD32ZX2368"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

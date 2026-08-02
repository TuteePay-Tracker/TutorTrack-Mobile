import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDz-2MfIgTJUjfRVY91uMKcRp1km-dsxlc",
  authDomain: "tutorial-management-capstone.firebaseapp.com",
  projectId: "tutorial-management-capstone",
  storageBucket: "tutorial-management-capstone.firebasestorage.app",
  messagingSenderId: "16404624980",
  appId: "1:16404624980:web:6b56f479eed22c7ea55fc1"
};

export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);

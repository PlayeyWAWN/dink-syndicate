import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFirebaseConfig } from '@/config/firebase';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let storage: FirebaseStorage | null = null;

/** Lazily initialize Firebase when build-time env vars are present. */
export function getFirebaseApp(): FirebaseApp | null {
  if (app) return app;
  const config = getFirebaseConfig();
  if (!config) return null;
  app = initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  auth = getAuth(firebaseApp);
  return auth;
}

export function getFirebaseFirestore(): Firestore | null {
  if (firestore) return firestore;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  firestore = getFirestore(firebaseApp);
  return firestore;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  if (storage) return storage;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  storage = getStorage(firebaseApp);
  return storage;
}

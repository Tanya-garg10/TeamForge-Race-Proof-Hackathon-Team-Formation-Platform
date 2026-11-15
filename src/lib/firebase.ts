import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'teamforge-demo',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:000000000000',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'teamforge-demo.firebaseapp.com',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'teamforge-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const firebaseAuth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const firestoreDb: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let connectionTested = false;

export async function verifyFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'demo-api-key') {
      await getDocFromServer(doc(firestoreDb, 'hackathons', 'health_probe'));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client appears offline; verify Firebase configuration.');
    }
  }
}

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase's web config is meant to be public — it identifies the project,
// it isn't a secret. Real access control lives in the Firestore security
// rules (see firestore.rules), which only let a signed-in user read or
// write documents under their own uid.
const firebaseConfig = {
  apiKey: 'AIzaSyCXCLq4E6WWRUSAqGtinQ9SfBzeLP-0cuc',
  authDomain: 'dnd-charchter-creator.firebaseapp.com',
  projectId: 'dnd-charchter-creator',
  storageBucket: 'dnd-charchter-creator.firebasestorage.app',
  messagingSenderId: '210859622330',
  appId: '1:210859622330:web:bc4084d20bfc5ad78d2783',
  measurementId: 'G-59V2RLBHX8',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA1djo2J_AguwLohVRbI7wZEreQTfkW3MA",
  authDomain: "methodical-theory-753sn.firebaseapp.com",
  projectId: "methodical-theory-753sn",
  storageBucket: "methodical-theory-753sn.firebasestorage.app",
  messagingSenderId: "302426426307",
  appId: "1:302426426307:web:166e192cb1443154ebcb76"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.addScope('email');
googleProvider.addScope('profile');

export { signInWithPopup, signOut };
export type { User };

import admin from 'firebase-admin';

let firebaseAdmin: admin.app.App;

export function initFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    firebaseAdmin = admin.apps[0]!;
    return firebaseAdmin;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });

  console.log('Firebase Admin SDK initialized');
  return firebaseAdmin;
}

export { admin };

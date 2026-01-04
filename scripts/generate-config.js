const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'firebase-config.js');

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const fileContent = `// Firebase Configuration (Generated)
const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 4)};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Export for use in other files
window.db = db;
`;

try {
    fs.writeFileSync(targetPath, fileContent);
    console.log('Successfully generated firebase-config.js');
} catch (error) {
    console.error('Error generating firebase-config.js:', error);
    process.exit(1);
}

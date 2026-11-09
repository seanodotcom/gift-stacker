const fs = require('fs');
const path = require('path');

console.log("Generating firebase-config.js...");

const targetPath = path.join(__dirname, '..', 'firebase-config.js');

const cleanEnv = (val) => val ? val.replace(/['";]/g, '').trim() : undefined;

// Read an env var, warning if it is missing or empty
const logEnv = (key) => {
    const val = process.env[key];
    if (val === undefined) {
        console.warn(`[WARNING] Env Var ${key} is UNDEFINED`);
        return undefined;
    }
    if (val === '') {
        console.warn(`[WARNING] Env Var ${key} is EMPTY STRING (Check Vercel Settings)`);
        return undefined;
    }
    if (!val) {
        console.warn(`[WARNING] Env Var ${key} is FALSY (${val})`);
        return undefined;
    }

    return cleanEnv(val);
};

const firebaseConfig = {
    apiKey: logEnv('FIREBASE_API_KEY'),
    authDomain: logEnv('FIREBASE_AUTH_DOMAIN'),
    projectId: logEnv('FIREBASE_PROJECT_ID'),
    storageBucket: logEnv('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: logEnv('FIREBASE_MESSAGING_SENDER_ID'),
    appId: logEnv('FIREBASE_APP_ID'),
    measurementId: logEnv('FIREBASE_MEASUREMENT_ID')
};

// VALIDATION
const missingKeys = Object.keys(firebaseConfig).filter(key => !firebaseConfig[key] && key !== 'measurementId');

if (missingKeys.length > 0) {
    console.error(`[ERROR] Missing required configuration keys: ${missingKeys.join(', ')}`);
    console.error("Please verify your Vercel Environment Variables are set correctly.");
    process.exit(1); // Fail the build
}

const fileContent = `// Firebase Configuration (Generated)
const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 4)};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    window.db = db;
} else {
    console.error("Firebase SDK not loaded!");
}
`;

try {
    fs.writeFileSync(targetPath, fileContent);
    console.log('Successfully generated firebase-config.js');
} catch (error) {
    console.error('Error writing firebase-config.js:', error);
    process.exit(1);
}

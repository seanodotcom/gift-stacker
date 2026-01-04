const fs = require('fs');
const path = require('path');

console.log("Generating firebase-config.js...");

const targetPath = path.join(__dirname, '..', 'firebase-config.js');

const cleanEnv = (val) => val ? val.replace(/['";]/g, '').trim() : undefined;

// DEBUG: Log ALL available keys (to see if we have a mismatch)
console.log("Available Env Vars:", Object.keys(process.env).join(', '));

// DEBUG: Log Env Vars (Masked)
const logEnv = (key) => {
    const val = process.env[key];
    if (!val) {
        console.warn(`[WARNING] Missing Env Var: ${key}`);
        return undefined;
    }
    const safeVal = cleanEnv(val);
    const masked = safeVal.length > 5 ? `${safeVal.substring(0, 3)}...` : '***';
    console.log(`[INFO] Found ${key}: ${masked}`);
    return safeVal;
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

console.log("[DEBUG] Loaded Firebase Config:", firebaseConfig);

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

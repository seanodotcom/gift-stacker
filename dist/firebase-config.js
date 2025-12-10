// Firebase Configuration
// IMPORTANT: Replace the placeholders below with your actual Firebase project configuration.
// You can get these details from the Firebase Console: Project Settings > General > Your Apps > SDK Setup and Configuration

const firebaseConfig = {
    apiKey: "AIzaSyBGj4SXJhlgY3CDfN3aG5ohCXX7uA6qma0",
    authDomain: "gift-stacker.firebaseapp.com",
    projectId: "gift-stacker",
    storageBucket: "gift-stacker.firebasestorage.app",
    messagingSenderId: "672527315580",
    appId: "1:672527315580:web:359984463dad4781ae4ff9",
    measurementId: "G-D2QMX8S083"
};

// Initialize Firebase
// We assume firebase is loaded via CDN in index.html, so 'firebase' global is available.
// If using modules, we would import them here.
// For simple CDN usage:
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Export for use in other files
window.db = db;

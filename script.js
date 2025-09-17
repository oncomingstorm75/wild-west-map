// --- 1. FIREBASE SETUP (Modern ES Module Style) ---

// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, ref, onChildAdded, onChildChanged, onChildRemoved, push, set, update, remove } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAh_wDgSsdpG-8zMmgcSVgyKl1IKOvD2mE",
    authDomain: "wild-west-map.firebaseapp.com",
    databaseURL: "https://wild-west-map-default-rtdb.firebaseio.com",
    projectId: "wild-west-map",
    storageBucket: "wild-west-map.firebasestorage.app",
    messagingSenderId: "255220822931",
    appId: "1:255220822931:web:7e44db610fe44bd7f72e66",
    measurementId: "G-3SPWSXBRNE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const pinsRef = ref(database, 'territory-data/pins');


// --- 2. LEAFLET MAP SETUP ---
// Your image's dimensions (Width x Height)
const mapWidth = 2048;
const mapHeight = 1741;

// Initialize the map
const map = L.map('map', {
    crs: L.CRS.Simple, // Use a simple coordinate system for a flat image
    minZoom: -2,
});

// Define the image bounds and add it to the map
const bounds = [[0, 0], [mapHeight, mapWidth]];
const image = L.imageOverlay('assets/image.png', bounds).addTo(map);
map.fitBounds(bounds);


// --- 3. CUSTOM PIN ICON ---
const sheriffStarIcon = L.icon({
    iconUrl: 'assets/sheriff-star.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

// Local object to keep track of markers on the map
const markers = {};


// --- 4. COLLABORATIVE FUNCTIONS ---

// Function to add a new pin when a user clicks the map
map.on('click', function(e) {
    const coords = e.latlng;
    const newPinRef = push(pinsRef); // Create a new unique ID
    set(newPinRef, {
        coords: coords,
        note: 'New territory...'
    });
});

// These functions must be attached to the global 'window' object
// so they can be called by the 'onclick' attributes in the HTML popup
window.updateNote = function(pinId) {
    const noteText = document.getElementById(`note-${pinId}`).value;
    const targetPinRef = ref(database, `territory-data/pins/${pinId}`);
    update(targetPinRef, { note: noteText });
    map.closePopup();
}

window.deletePin = function(pinId) {
    const targetPinRef = ref(database, `territory-data/pins/${pinId}`);
    remove(targetPinRef);
}


// --- 5. FIREBASE REAL-TIME LISTENERS (Modern Style) ---

// When a new pin is added to Firebase, add it to the map
onChildAdded(pinsRef, (snapshot) => {
    const pinId = snapshot.key;
    const pinData = snapshot.val();
    
    const marker = L.marker(pinData.coords, { icon: sheriffStarIcon, draggable: true })
        .addTo(map)
        .bindPopup(`
            <textarea id="note-${pinId}">${pinData.note}</textarea>
            <button onclick="updateNote('${pinId}')">Save Note</button>
            <br>
            <button onclick="deletePin('${pinId}')">Delete Pin</button>
        `);

    // Listen for drag events to update coordinates
    marker.on('dragend', function(event) {
        const targetPinRef = ref(database, `territory-data/pins/${pinId}`);
        update(targetPinRef, { coords: event.target.getLatLng() });
    });

    markers[pinId] = marker;
});

// When a pin is removed from Firebase, remove it from the map
onChildRemoved(pinsRef, (snapshot) => {
    const pinId = snapshot.key;
    if (markers[pinId]) {
        map.removeLayer(markers[pinId]);
        delete markers[pinId];
    }
});

// When a pin's data changes, update it on the map
onChildChanged(pinsRef, (snapshot) => {
    const pinId = snapshot.key;
    const pinData = snapshot.val();
    if (markers[pinId]) {
        markers[pinId].setLatLng(pinData.coords);
        markers[pinId].getPopup().setContent(`
            <textarea id="note-${pinId}">${pinData.note}</textarea>
            <button onclick="updateNote('${pinId}')">Save Note</button>
            <br>
            <button onclick="deletePin('${pinId}')">Delete Pin</button>
        `);
    }
});

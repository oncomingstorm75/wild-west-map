// --- 1. FIREBASE SETUP ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAh_wDgSsdpG-8zMmgcSVgyKl1IKOvD2mE",
    authDomain: "wild-west-map.firebaseapp.com",
    databaseURL: "https://wild-west-map-default-rtdb.firebaseio.com",
    projectId: "wild-west-map",
    storageBucket: "wild-west-map.appspot.com",
    messagingSenderId: "255220822931",
    appId: "1:255220822931:web:7e44db610fe44bd7f72e66",
    measurementId: "G-3SPWSXBRNE"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const pinsRef = ref(database, 'pins');

// --- 2. LEAFLET MAP SETUP ---
const mapWidth = 2048;
const mapHeight = 1741;
const map = L.map('map', { crs: L.CRS.Simple, minZoom: -2 });
const bounds = [[0, 0], [mapHeight, mapWidth]];
L.imageOverlay('assets/image.png', bounds).addTo(map);
map.fitBounds(bounds);

// --- 3. DOM ELEMENT REFERENCES ---
const notesSidebar = document.getElementById('notes-sidebar');
const notesList = document.getElementById('notes-list');
const toggleButton = document.getElementById('toggle-notes');

// --- 4. LOCAL DATA & STATE ---
const markers = {}; // Holds Leaflet marker objects
let allPinsData = {}; // Holds all pin data from Firebase

// --- 5. CORE FUNCTIONS ---

// Function to render the entire sidebar from scratch
function renderSidebar() {
    notesList.innerHTML = ''; // Clear the list
    for (const pinId in allPinsData) {
        const pinData = allPinsData[pinId];
        const listItem = document.createElement('li');
        listItem.dataset.category = pinData.category || 'default';
        listItem.innerHTML = `<h3>${pinData.title || 'Untitled'}</h3><p>${pinData.note}</p>`;
        notesList.appendChild(listItem);
    }
}

// Function to handle map clicks to add new pins
function addPin(e) {
    const coords = e.latlng;
    const title = prompt("Enter a title for the new pin:");
    if (!title) return;

    const category = prompt("Enter a category: quest, hostile, clue, safe").toLowerCase();
    const validCategories = ['quest', 'hostile', 'clue', 'safe'];
    const pinCategory = validCategories.includes(category) ? category : 'default';
    
    const newPinRef = push(pinsRef);
    set(newPinRef, {
        coords: coords,
        title: title,
        note: 'New territory...',
        category: pinCategory
    });
}

// Function to update the note of an existing pin
window.updateNote = function(pinId) {
    const noteText = document.getElementById(`note-${pinId}`).value;
    const targetPinRef = ref(database, `pins/${pinId}`);
    update(targetPinRef, { note: noteText });
    map.closePopup();
}

// Function to delete a pin
window.deletePin = function(pinId) {
    const targetPinRef = ref(database, `pins/${pinId}`);
    remove(targetPinRef);
}

// --- 6. EVENT LISTENERS ---

// Listen for map clicks
map.on('click', addPin);

// Listen for sidebar toggle button clicks
toggleButton.addEventListener('click', () => {
    notesSidebar.classList.toggle('open');
});

// --- 7. FIREBASE REAL-TIME LISTENER ---
onValue(pinsRef, (snapshot) => {
    allPinsData = snapshot.val() || {};
    
    // Remove markers that are no longer in Firebase
    for (const pinId in markers) {
        if (!allPinsData[pinId]) {
            map.removeLayer(markers[pinId]);
            delete markers[pinId];
        }
    }

    // Add or update markers on the map
    for (const pinId in allPinsData) {
        const pinData = allPinsData[pinId];
        
        // Create a custom colored icon
        const icon = L.divIcon({
            className: `custom-div-icon ${pinData.category || 'default'}`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
        });

        // HTML content for the popup
        const popupContent = `
            <h3>${pinData.title}</h3>
            <textarea id="note-${pinId}">${pinData.note}</textarea>
            <button onclick="updateNote('${pinId}')">Save Note</button>
            <br>
            <button onclick="deletePin('${pinId}')">Delete Pin</button>
        `;

        if (markers[pinId]) {
            // If marker exists, update its position and icon
            markers[pinId].setLatLng(pinData.coords);
            markers[pinId].setIcon(icon);

        } else {
            // If it's a new marker, create it
            const marker = L.marker(pinData.coords, { icon: icon, draggable: true })
                .addTo(map)
                .bindPopup(popupContent);

            marker.on('dragend', function(event) {
                const targetPinRef = ref(database, `pins/${pinId}`);
                update(targetPinRef, { coords: event.target.getLatLng() });
            });
            markers[pinId] = marker;
        }
    }
    
    // Re-render the sidebar with the latest data
    renderSidebar();
});

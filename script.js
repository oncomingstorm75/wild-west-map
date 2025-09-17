// --- 1. FIREBASE SETUP ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

const firebaseConfig = {
    // PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE
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

// NEW: Modal elements
const pinModal = document.getElementById('pin-modal');
const closeButton = pinModal.querySelector('.close-button');
const pinTitleInput = document.getElementById('pin-title');
const pinNoteTextarea = document.getElementById('pin-note');
const pinCategoryRadios = document.querySelectorAll('input[name="pin-category"]');
const savePinButton = document.getElementById('save-pin-button');

let clickedCoords = null; // Store coords when map is clicked for modal

// --- 4. LOCAL DATA & STATE ---
const markers = {}; // Holds Leaflet marker objects
let allPinsData = {}; // Holds all pin data from Firebase

// NEW: Map category to Font Awesome icon classes
const categoryIcons = {
    quest: 'fas fa-map-pin', // Previously 'fas fa-scroll' for general notes
    hostile: 'fas fa-skull',
    clue: 'fas fa-question-circle',
    safe: 'fas fa-star',
    default: 'fas fa-compass' // A generic default icon
};

// --- 5. CORE FUNCTIONS ---

// Function to render the entire sidebar from scratch
function renderSidebar() {
    notesList.innerHTML = ''; // Clear the list
    for (const pinId in allPinsData) {
        const pinData = allPinsData[pinId];
        const listItem = document.createElement('li');
        listItem.dataset.category = pinData.category || 'default';
        // NEW: Make sidebar items clickable to jump to the pin (optional)
        listItem.addEventListener('click', () => {
            if (markers[pinId]) {
                markers[pinId].openPopup();
                map.setView(markers[pinId].getLatLng(), map.getZoom()); // Center map on pin
            }
        });

        const iconClass = categoryIcons[pinData.category] || categoryIcons['default'];
        listItem.innerHTML = `
            <h3><i class="${iconClass}"></i> ${pinData.title || 'Untitled'}</h3>
            <p>${pinData.note}</p>
        `;
        notesList.appendChild(listItem);
    }
}

// NEW: Function to open the pin creation modal
function openPinModal(coords) {
    clickedCoords = coords;
    pinTitleInput.value = '';
    pinNoteTextarea.value = '';
    // Reset category selection to default (quest)
    document.getElementById('cat-quest').checked = true; 
    pinModal.style.display = 'block';
}

// NEW: Function to close the pin creation modal
function closePinModal() {
    pinModal.style.display = 'none';
}


// Function to handle map clicks to add new pins (now opens modal)
map.on('click', function(e) {
    openPinModal(e.latlng);
});


// Function to save a new pin from the modal
savePinButton.addEventListener('click', () => {
    const title = pinTitleInput.value.trim();
    const note = pinNoteTextarea.value.trim();
    const selectedCategory = document.querySelector('input[name="pin-category"]:checked').value;

    if (!title) {
        alert('Please enter a title for the pin.');
        return;
    }

    if (clickedCoords) {
        const newPinRef = push(pinsRef);
        set(newPinRef, {
            coords: clickedCoords,
            title: title,
            note: note,
            category: selectedCategory
        });
        closePinModal();
    }
});


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

// Listen for sidebar toggle button clicks
toggleButton.addEventListener('click', () => {
    notesSidebar.classList.toggle('open');
});

// NEW: Modal close button and outside click
closeButton.addEventListener('click', closePinModal);
window.addEventListener('click', (event) => {
    if (event.target == pinModal) {
        closePinModal();
    }
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
        
        // Determine icon based on category
        const iconClass = categoryIcons[pinData.category] || categoryIcons['default'];
        
        // Create a custom colored icon with Font Awesome icon inside
        const icon = L.divIcon({
            className: `custom-div-icon ${pinData.category || 'default'}`,
            html: `<i class="${iconClass}"></i>`, // NEW: Add Font Awesome icon here
            iconSize: [28, 28], // Smaller size
            iconAnchor: [14, 14], // Half of iconSize for centering
            popupAnchor: [0, -14] // Adjust popup anchor for new size
        });

        // HTML content for the popup
        const popupContent = `
            <h3>${pinData.title}</h3>
            <textarea id="note-${pinId}">${pinData.note}</textarea>
            <button class="western-button" onclick="updateNote('${pinId}')">Save Note</button>
            <button class="western-button" onclick="deletePin('${pinId}')">Delete Pin</button>
        `;

        if (markers[pinId]) {
            // If marker exists, update its position and icon
            markers[pinId].setLatLng(pinData.coords);
            markers[pinId].setIcon(icon);
            // Also update popup content in case title/note changed
            markers[pinId].getPopup().setContent(popupContent);

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

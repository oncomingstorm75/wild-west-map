// --- 1. FIREBASE IMPORTS (MUST BE AT THE TOP LEVEL) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// This function contains all of our app's logic.
function initializeMap() {
    // --- 2. FIREBASE CONFIG & INITIALIZATION ---
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

    // --- 3. LEAFLET MAP SETUP ---
    const mapWidth = 2048;
    const mapHeight = 1741;
    const map = L.map('map', { crs: L.CRS.Simple, minZoom: -2 });
    const bounds = [[0, 0], [mapHeight, mapWidth]];
   
    // THE CRITICAL FIX: Make the image layer interactive.
    const image = L.imageOverlay('assets/image.png', bounds, { interactive: true }).addTo(map);
   
    map.fitBounds(bounds);

    // Optional: Debug image load (add these lines if image isn't showing)
    // image.on('load', () => console.log('Image loaded!'));
    // image.on('error', () => console.error('Image failed to load - check path!'));

    // --- 4. DOM ELEMENT REFERENCES ---
    const notesSidebar = document.getElementById('notes-sidebar');
    const notesList = document.getElementById('notes-list');
    const toggleButton = document.getElementById('toggle-notes');
    const mapContainer = document.getElementById('map');
    const addPinModeButton = document.getElementById('add-pin-mode-button');
    const pinModal = document.getElementById('pin-modal');
    const closeButton = pinModal.querySelector('.close-button');
    const pinTitleInput = document.getElementById('pin-title');
    const pinNoteTextarea = document.getElementById('pin-note');
    const savePinButton = document.getElementById('save-pin-button');

    // --- 5. LOCAL DATA & STATE ---
    const markers = {};
    let allPinsData = {};
    let inAddPinMode = false;
    let clickedCoords = null;
    const categoryIcons = {
        quest: 'fas fa-map-pin',
        hostile: 'fas fa-skull',
        clue: 'fas fa-question-circle',
        safe: 'fas fa-star',
        default: 'fas fa-compass'
    };

    // --- 6. CORE FUNCTIONS ---
    function renderSidebar() {
        notesList.innerHTML = '';
        for (const pinId in allPinsData) {
            const pinData = allPinsData[pinId];
            const listItem = document.createElement('li');
            listItem.dataset.category = pinData.category || 'default';
            listItem.addEventListener('click', () => {
                if (markers[pinId]) {
                    markers[pinId].openPopup();
                    map.setView(markers[pinId].getLatLng(), map.getZoom());
                }
            });
            const iconClass = categoryIcons[pinData.category] || categoryIcons['default'];
            listItem.innerHTML = `<h3><i class="${iconClass}"></i> ${pinData.title || 'Untitled'}</h3><p>${pinData.note}</p>`;
            notesList.appendChild(listItem);
        }
    }

    function enterAddPinMode() {
        inAddPinMode = true;
        mapContainer.classList.add('add-pin-mode');
        addPinModeButton.classList.add('active');
        map.dragging.disable();  // Lock the map for precise pinning—no accidental pans.
        console.log('Add Pin Mode: ON (dragging disabled)');  // DEBUG: Confirm mode entry.
    }

    function exitAddPinMode() {
        inAddPinMode = false;
        mapContainer.classList.remove('add-pin-mode');
        addPinModeButton.classList.remove('active');
        map.dragging.enable();  // Re-enable dragging for normal use.
        console.log('Add Pin Mode: OFF (dragging enabled)');  // DEBUG.
    }

    function openPinModal(coords) {
        clickedCoords = coords;
        pinTitleInput.value = '';
        pinNoteTextarea.value = '';
        document.getElementById('cat-quest').checked = true;
        pinModal.style.display = 'block';
        console.log('Modal opened at coords:', coords);  // DEBUG: Verify click capture.
    }

    function closePinModal() {
        pinModal.style.display = 'none';
    }

    // --- 7. EVENT LISTENERS ---
    addPinModeButton.addEventListener('click', () => {
        if (inAddPinMode) {
            exitAddPinMode();
        } else {
            enterAddPinMode();
        }
    });

    // CRITICAL FIX: Use map-level click listener—reliable, catches all interactions.
    map.on('click', function(e) {
        if (inAddPinMode) {
            console.log('Map clicked in add mode at:', e.latlng);  // DEBUG: See if firing.
            openPinModal(e.latlng);
        }
        // Note: Outside add mode, this lets normal panning happen.
    });

    savePinButton.addEventListener('click', () => {
        const title = pinTitleInput.value.trim();
        const note = pinNoteTextarea.value.trim();
        const selectedCategory = document.querySelector('input[name="pin-category"]:checked').value;
        if (!title || !clickedCoords) {
            console.warn('Save failed: Missing title or coords');  // DEBUG.
            return;
        }
        const newPinRef = push(pinsRef);
        set(newPinRef, {
            coords: clickedCoords,
            title: title,
            note: note,
            category: selectedCategory
        }).then(() => {
            console.log('Pin saved to Firebase!');  // DEBUG: Confirm write.
        }).catch(err => console.error('Firebase save error:', err));
        closePinModal();
        exitAddPinMode();
    });

    toggleButton.addEventListener('click', () => {
        notesSidebar.classList.toggle('open');
    });
    closeButton.addEventListener('click', closePinModal);
    window.addEventListener('click', (event) => {
        if (event.target == pinModal) {
            closePinModal();
        }
    });

    // --- 8. FIREBASE REAL-TIME LISTENER for PINS ---
    onValue(pinsRef, (snapshot) => {
        allPinsData = snapshot.val() || {};
        for (const pinId in markers) {
            if (!allPinsData[pinId]) {
                map.removeLayer(markers[pinId]);
                delete markers[pinId];
            }
        }
        for (const pinId in allPinsData) {
            const pinData = allPinsData[pinId];
            const iconClass = categoryIcons[pinData.category] || categoryIcons['default'];
            const icon = L.divIcon({
                className: `custom-div-icon ${pinData.category || 'default'}`,
                html: `<i class="${iconClass}"></i>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });
            const popupElement = document.createElement('div');
            const titleElement = document.createElement('h3');
            titleElement.textContent = pinData.title;
            const noteArea = document.createElement('textarea');
            noteArea.value = pinData.note;
            const saveButton = document.createElement('button');
            saveButton.textContent = 'Save Note';
            saveButton.className = 'western-button';
            saveButton.addEventListener('click', () => {
                const targetPinRef = ref(database, `pins/${pinId}`);
                update(targetPinRef, { note: noteArea.value });
                map.closePopup();
            });
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete Pin';
            deleteButton.className = 'western-button';
            deleteButton.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete "${pinData.title}"?`)) {
                    const targetPinRef = ref(database, `pins/${pinId}`);
                    remove(targetPinRef);
                }
            });
            popupElement.append(titleElement, noteArea, saveButton, deleteButton);
            if (markers[pinId]) {
                markers[pinId].setLatLng(pinData.coords);
                markers[pinId].setIcon(icon);
                markers[pinId].getPopup().setContent(popupElement);
            } else {
                const marker = L.marker(pinData.coords, { icon: icon, draggable: true }).addTo(map).bindPopup(popupElement);
                marker.on('dragend', (event) => update(ref(database, `pins/${pinId}`), { coords: event.target.getLatLng() }));
                markers[pinId] = marker;
            }
        }
        renderSidebar();
    });
}

// This event listener waits for the entire HTML document to be loaded, then runs our main function.
document.addEventListener('DOMContentLoaded', initializeMap);

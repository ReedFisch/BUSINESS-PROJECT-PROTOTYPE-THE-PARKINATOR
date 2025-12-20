// Initial Credentials - Using Hudson, NY
// Hudson Amtrak Station approx location
const DEMO_LAT = 42.2536;
const DEMO_LNG = -73.7965;

const appState = {
    isParkingMode: false,
    map: null,
    parkingLayer: null
};

// Parking Spots Data (Fake Data)
// Relative offsets to the center to simulate a lot
const parkingSpots = [
    { id: 1, latOffset: 0.0001, lngOffset: 0.0001, available: true },
    { id: 2, latOffset: 0.0001, lngOffset: 0.0002, available: false },
    { id: 3, latOffset: 0.0001, lngOffset: 0.0003, available: true },
    { id: 4, latOffset: 0.0001, lngOffset: 0.0004, available: false },
    { id: 5, latOffset: 0.0000, lngOffset: 0.0001, available: true },
    { id: 6, latOffset: 0.0000, lngOffset: 0.0002, available: true }, // Targeted spot
    { id: 7, latOffset: 0.0000, lngOffset: 0.0003, available: false },
    { id: 8, latOffset: 0.0000, lngOffset: 0.0004, available: false },
];

function initApp() {
    // Initialize Leaflet Map
    appState.map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([DEMO_LAT, DEMO_LNG], 17); // High zoom for Arrival

    // Standard Map Tiles (Voyager / CartoDB for clean look)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
    }).addTo(appState.map);

    // Initial Marker (Destination)
    L.marker([DEMO_LAT, DEMO_LNG]).addTo(appState.map)
        .bindPopup('Hudson Amtrak Station').openPopup();

    // Event Listeners
    document.getElementById('enable-parking-btn').addEventListener('click', enableParkingMode);
    document.getElementById('navigate-spot-btn').addEventListener('click', navigateToSpot);
}

function enableParkingMode() {
    console.log("Activating Parking Mode...");

    // 1. Zoom in and switch to "Satellite" feel
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 22
    }).addTo(appState.map);

    appState.map.flyTo([DEMO_LAT, DEMO_LNG], 19, {
        animate: true,
        duration: 1.5
    });

    // 2. UI Transitions
    document.getElementById('arrival-panel').classList.add('hidden');

    setTimeout(() => {
        document.getElementById('parking-panel').classList.remove('hidden');
        renderParkingSpots();
    }, 1200);
}

function renderParkingSpots() {
    const boxSize = 0.00004;

    parkingSpots.forEach(spot => {
        const spotLat = DEMO_LAT + spot.latOffset;
        const spotLng = DEMO_LNG + spot.lngOffset;

        const color = spot.available ? '#34C759' : '#FF3B30';

        const bounds = [
            [spotLat - boxSize, spotLng - boxSize],
            [spotLat + boxSize, spotLng + boxSize]
        ];

        L.rectangle(bounds, {
            color: color,
            fillColor: color,
            fillOpacity: 0.6,
            weight: 2
        }).addTo(appState.map);
    });
}

function navigateToSpot() {
    // Simulate finding the best spot (spot #6 is our target)
    const targetSpot = parkingSpots.find(s => s.id === 6);
    const start = [DEMO_LAT, DEMO_LNG]; // Entrance
    const end = [DEMO_LAT + targetSpot.latOffset, DEMO_LNG + targetSpot.lngOffset];

    // Simple polyline for visual
    const routeLine = [
        start,
        [start[0], end[1]], // elbow turn
        end
    ];

    L.polyline(routeLine, {
        color: '#007AFF',
        weight: 5,
        dashArray: '10, 10',
        opacity: 0.8
    }).addTo(appState.map);

    appState.map.fitBounds(L.polyline(routeLine).getBounds(), { padding: [50, 50] });
}

// Start
document.addEventListener('DOMContentLoaded', initApp);

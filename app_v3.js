// Initial Credentials - Using Hudson Amtrak Station
const DEMO_LAT = 42.2538;
const DEMO_LNG = -73.7968;

const appState = {
    isParkingMode: false,
    map: null,
    parkingPolygons: [],
    navigationLine: null
};

// Parking Spots Data (Fake Data)
// Calibrated for TIGHTER spacing and SMALLER size (v3.1)
const parkingSpots = [
    // Row 1 (North)
    // Decreased lng spacing from 0.00005 to 0.00003
    { id: 1, latOffset: 0.00009, lngOffset: -0.000045, available: true },
    { id: 2, latOffset: 0.00009, lngOffset: -0.000015, available: false },
    { id: 3, latOffset: 0.00009, lngOffset: 0.000015, available: true },
    { id: 4, latOffset: 0.00009, lngOffset: 0.000045, available: false },

    // Row 2 (South)
    // Decreased lat gap between rows (driving lane) from 0.00008 to 0.00006
    { id: 5, latOffset: 0.00003, lngOffset: -0.000045, available: true },
    { id: 6, latOffset: 0.00003, lngOffset: -0.000015, available: true }, // Targeted spot
    { id: 7, latOffset: 0.00003, lngOffset: 0.000015, available: false },
    { id: 8, latOffset: 0.00003, lngOffset: 0.000045, available: false },
];

function initApp() {
    // Standard Google Maps Setup
    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 20, // Increased default zoom slightly
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        heading: 0,
        tilt: 45,
    });

    // Initial Marker
    new google.maps.Marker({
        position: { lat: DEMO_LAT, lng: DEMO_LNG },
        map: appState.map,
        title: "Hudson Amtrak Station"
    });

    // Event Listeners
    document.getElementById('enable-parking-btn').addEventListener('click', enableParkingMode);
    document.getElementById('navigate-spot-btn').addEventListener('click', navigateToSpot);
}

function enableParkingMode() {
    console.log("Activating Parking Mode...");

    // 1. Zoom in and Tilt for "Parking/Arrival" feel
    appState.map.moveCamera({
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 21,
        tilt: 45,
        heading: 0
    });

    // 2. UI Transitions
    document.getElementById('arrival-panel').classList.add('hidden');

    setTimeout(() => {
        document.getElementById('parking-panel').classList.remove('hidden');
        renderParkingSpots();
    }, 1000);
}

function renderParkingSpots() {
    // v3.1 ADJUSTMENTS
    // Reduced dimensions again for realism
    const heightLat = 0.000035; // Previously 0.000040
    const widthLng = 0.000022;  // Previously 0.000028

    parkingSpots.forEach(spot => {
        const spotLat = DEMO_LAT + spot.latOffset;
        const spotLng = DEMO_LNG + spot.lngOffset;

        const color = spot.available ? '#34C759' : '#FF3B30';

        // Define rectangle bounds (centered on the point)
        const halfH = heightLat / 2;
        const halfW = widthLng / 2;

        const coords = [
            { lat: spotLat - halfH, lng: spotLng - halfW }, // SW
            { lat: spotLat + halfH, lng: spotLng - halfW }, // NW
            { lat: spotLat + halfH, lng: spotLng + halfW }, // NE
            { lat: spotLat - halfH, lng: spotLng + halfW }, // SE
        ];

        const polygon = new google.maps.Polygon({
            paths: coords,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.35,
            map: appState.map
        });

        appState.parkingPolygons.push(polygon);
    });
}

function navigateToSpot() {
    // Simulate finding the best spot (spot #6 is our target)
    const targetSpot = parkingSpots.find(s => s.id === 6);
    const start = { lat: DEMO_LAT, lng: DEMO_LNG };
    const end = { lat: DEMO_LAT + targetSpot.latOffset, lng: DEMO_LNG + targetSpot.lngOffset };

    // Simple path for visual
    const navigationPath = [
        start,
        { lat: start.lat, lng: end.lng }, // elbow turn
        end
    ];

    appState.navigationLine = new google.maps.Polyline({
        path: navigationPath,
        geodesic: true,
        strokeColor: "#007AFF",
        strokeOpacity: 1.0,
        strokeWeight: 5,
        map: appState.map
    });

    // Adjust camera to fit the path
    appState.map.panTo(start);
}

// Start 
window.onload = initApp;

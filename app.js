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
// Calibrated for standard parking spot size (~9x18ft)
// Spaced to avoid overlap
const parkingSpots = [
    // Row 1 (North) - Spaced wider apart
    { id: 1, latOffset: 0.00010, lngOffset: -0.00006, available: true },
    { id: 2, latOffset: 0.00010, lngOffset: -0.00002, available: false },
    { id: 3, latOffset: 0.00010, lngOffset: 0.00002, available: true },
    { id: 4, latOffset: 0.00010, lngOffset: 0.00006, available: false },
    // Row 2 (South, relative to Row 1) - clear gap between rows
    { id: 5, latOffset: 0.00004, lngOffset: -0.00006, available: true },
    { id: 6, latOffset: 0.00004, lngOffset: -0.00002, available: true }, // Targeted spot
    { id: 7, latOffset: 0.00004, lngOffset: 0.00002, available: false },
    { id: 8, latOffset: 0.00004, lngOffset: 0.00006, available: false },
];

function initApp() {
    // Standard Google Maps Setup
    // "Cartoon buildings" = vector map with 3D buildings enabled by default + tilt
    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 19, // Closer zoom by default to see spots clearly
        mapTypeId: "roadmap",
        disableDefaultUI: true, // Clean "App" look
        heading: 0,
        tilt: 45, // Gives the 3D perspective
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
    // SIGNIFICANTLY REDUCED SIZE
    // Standard Spot Size: ~2.5m x 5m
    const heightLat = 0.000025;
    const widthLng = 0.000025;

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

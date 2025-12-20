// Initial Credentials - Using Hudson Amtrak Station
const DEMO_LAT = 42.25385;
const DEMO_LNG = -73.79678;

const appState = {
    isParkingMode: false,
    map: null,
    parkingPolygons: [],
    navigationLine: null
};

// Street Heading: Adjusted from 322 -> 316 based on visual feedback
const STREET_HEADING = 316;

// Base anchor point
const ANCHOR_LAT = 42.25382;
const ANCHOR_LNG = -73.79672;

// Spot Dimensions (Reduced)
const SPOT_WIDTH_METERS = 2.2;
const SPOT_LENGTH_METERS = 5.2;
const GAP_METERS = 0.1;

// Helper to move a point by meters
function offsetGap(lat, lng, bearing, distanceMeters) {
    const R = 6378137;
    const dn = distanceMeters * Math.cos(bearing * Math.PI / 180);
    const de = distanceMeters * Math.sin(bearing * Math.PI / 180);
    const dLat = dn / R;
    const dLon = de / (R * Math.cos(Math.PI * lat / 180));
    return {
        lat: lat + dLat * 180 / Math.PI,
        lng: lng + dLon * 180 / Math.PI
    };
}

// Data: 6 spots
const parkingSpots = [
    { id: 1, available: true },
    { id: 2, available: false },
    { id: 3, available: true },
    { id: 4, available: true },
    { id: 5, available: false },
    { id: 6, available: false },
];

function initApp() {
    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 20,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        heading: 0,
        tilt: 45,
        // mapId is technically required for full vector heading on some browsers,
        // but we'll try without first or user needs to add one.
    });

    new google.maps.Marker({
        position: { lat: DEMO_LAT, lng: DEMO_LNG },
        map: appState.map,
        title: "Hudson Amtrak Station"
    });

    document.getElementById('enable-parking-btn').addEventListener('click', enableParkingMode);
    document.getElementById('navigate-spot-btn').addEventListener('click', navigateToSpot);
}

function enableParkingMode() {
    console.log("Activating Parking Mode...");

    appState.map.moveCamera({
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 21,
        tilt: 45,
        heading: STREET_HEADING // Rotate map to align with street
    });

    document.getElementById('arrival-panel').classList.add('hidden');

    // Slight delay to allow camera move to start
    setTimeout(() => {
        document.getElementById('parking-panel').classList.remove('hidden');
        renderParkingSpots();
    }, 1000);
}

function getRectCoords(centerLat, centerLng, widthM, lengthM, heading) {
    const diagDist = Math.sqrt((widthM / 2) ** 2 + (lengthM / 2) ** 2);
    const alpha = Math.atan(widthM / lengthM) * (180 / Math.PI);

    const bearings = [
        heading + alpha,        // NE
        heading + 180 - alpha,  // SE
        heading + 180 + alpha,  // SW
        heading - alpha         // NW
    ];

    return bearings.map(b => offsetGap(centerLat, centerLng, b, diagDist));
}

function renderParkingSpots() {
    let currentCenter = { lat: ANCHOR_LAT, lng: ANCHOR_LNG };

    parkingSpots.forEach((spot) => {
        const color = spot.available ? '#34C759' : '#FF3B30';

        const coords = getRectCoords(
            currentCenter.lat,
            currentCenter.lng,
            SPOT_WIDTH_METERS,
            SPOT_LENGTH_METERS,
            STREET_HEADING
        );

        const polygon = new google.maps.Polygon({
            paths: coords,
            strokeColor: color,
            strokeOpacity: 1.0,
            strokeWeight: 1,
            fillColor: color,
            fillOpacity: 0.4,
            map: appState.map
        });

        spot.center = currentCenter;
        appState.parkingPolygons.push(polygon);

        // Advance center
        currentCenter = offsetGap(
            currentCenter.lat,
            currentCenter.lng,
            STREET_HEADING,
            SPOT_LENGTH_METERS + GAP_METERS
        );
    });
}

function navigateToSpot() {
    // 1. Find User Position (Simulated as Station Marker)
    const start = { lat: DEMO_LAT, lng: DEMO_LNG };

    // 2. Find Closest AVAILABLE Spot
    const availableSpots = parkingSpots.filter(s => s.available);

    if (availableSpots.length === 0) {
        alert("No spots available!");
        return;
    }

    // Sort by distance (simple geometric distance)
    availableSpots.sort((a, b) => {
        const distA = Math.hypot(a.center.lat - start.lat, a.center.lng - start.lng);
        const distB = Math.hypot(b.center.lat - start.lat, b.center.lng - start.lng);
        return distA - distB;
    });

    const targetSpot = availableSpots[0];
    const end = targetSpot.center;

    console.log(`Navigating to closest spot ID: ${targetSpot.id}`);

    // Drawing the path
    if (appState.navigationLine) {
        appState.navigationLine.setMap(null);
    }

    const navigationPath = [start, end];

    appState.navigationLine = new google.maps.Polyline({
        path: navigationPath,
        geodesic: true,
        strokeColor: "#007AFF",
        strokeOpacity: 1.0,
        strokeWeight: 5,
        icons: [{
            icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4,
                strokeColor: "#007AFF"
            },
            offset: '100%'
        }],
        map: appState.map
    });

    appState.map.panTo(start);
}

window.onload = initApp;

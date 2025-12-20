// Initial Credentials - Using Hudson Amtrak Station
const DEMO_LAT = 42.25385;
const DEMO_LNG = -73.79678;

const appState = {
    isParkingMode: false,
    map: null,
    parkingPolygons: [],
    navigationLine: null,
    computedHeading: 0
};

// CROSS STREET COORDINATES (Hudson, NY)
// By defining the street as two points, we can mathematically compute the exact angle.
// Point A: Near 2nd St intersection
const STREET_START = { lat: 42.25368, lng: -73.79645 };
// Point B: Near Front St intersection (Heading NW)
const STREET_END = { lat: 42.25402, lng: -73.79705 };

// Spot Dimensions (Compact Parallel Parking)
const SPOT_WIDTH_METERS = 2.1;
const SPOT_LENGTH_METERS = 5.0;
const GAP_METERS = 0.5; // Small gap between cars

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
    // 1. Calculate the Street Heading automatically using Geometry Library
    // This answers the question: "What is the angle of this street?"
    appState.computedHeading = google.maps.geometry.spherical.computeHeading(STREET_START, STREET_END);

    console.log(`Auto-Computed Street Heading: ${appState.computedHeading.toFixed(2)} degrees`);

    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 20,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        heading: 0,
        tilt: 45,
    });

    // Debug Marker: Show where the street line is (Optional, for verification)
    /*
    new google.maps.Polyline({
        path: [STREET_START, STREET_END],
        map: appState.map,
        strokeColor: "yellow",
        strokeWeight: 2 
    });
    */

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

    // Rotate map to the computed street heading
    appState.map.moveCamera({
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 21,
        tilt: 45,
        heading: appState.computedHeading
    });

    document.getElementById('arrival-panel').classList.add('hidden');

    setTimeout(() => {
        document.getElementById('parking-panel').classList.remove('hidden');
        renderParkingSpots();
    }, 1000);
}

function renderParkingSpots() {
    // Start drawing spots from the "Start" of our defined street definition,
    // moved slightly to the side (curb offset)

    // Offset perpendicular to street to put it on the "right" side (or left)
    // +90 degrees relative to heading for right side
    const curbOffsetStart = google.maps.geometry.spherical.computeOffset(
        STREET_START,
        4, // 4 meters from center line (approx curb)
        appState.computedHeading + 90
    );

    // Move up a bit so we aren't in the intersection
    let currentCenter = google.maps.geometry.spherical.computeOffset(
        curbOffsetStart,
        15, // 15 meters up the road
        appState.computedHeading
    );

    parkingSpots.forEach((spot) => {
        const color = spot.available ? '#34C759' : '#FF3B30';

        // Calculate the 4 corners of the rotated rect
        // We use the computed street heading for exact alignment
        const corners = getRectCoords(currentCenter, SPOT_WIDTH_METERS, SPOT_LENGTH_METERS, appState.computedHeading);

        const polygon = new google.maps.Polygon({
            paths: corners,
            strokeColor: color,
            strokeOpacity: 1.0,
            strokeWeight: 1,
            fillColor: color,
            fillOpacity: 0.4,
            map: appState.map
        });

        spot.center = currentCenter;
        appState.parkingPolygons.push(polygon);

        // Move center for next spot
        currentCenter = google.maps.geometry.spherical.computeOffset(
            currentCenter,
            SPOT_LENGTH_METERS + GAP_METERS,
            appState.computedHeading
        );
    });
}

function getRectCoords(center, width, length, heading) {
    const diagDist = Math.sqrt((width / 2) ** 2 + (length / 2) ** 2);
    const alpha = Math.atan(width / length) * (180 / Math.PI);

    // Angles to the 4 corners relative to North
    const angles = [
        heading + alpha,
        heading + 180 - alpha,
        heading + 180 + alpha,
        heading - alpha
    ];

    return angles.map(angle =>
        google.maps.geometry.spherical.computeOffset(center, diagDist, angle)
    );
}

function navigateToSpot() {
    const start = { lat: DEMO_LAT, lng: DEMO_LNG };

    // Smart Nav: Find closest available
    const availableSpots = parkingSpots.filter(s => s.available);
    if (availableSpots.length === 0) return;

    availableSpots.sort((a, b) => {
        const distA = google.maps.geometry.spherical.computeDistanceBetween(start, a.center);
        const distB = google.maps.geometry.spherical.computeDistanceBetween(start, b.center);
        return distA - distB;
    });

    const targetSpot = availableSpots[0];
    const end = targetSpot.center;

    if (appState.navigationLine) appState.navigationLine.setMap(null);

    appState.navigationLine = new google.maps.Polyline({
        path: [start, end],
        geodesic: true,
        strokeColor: "#007AFF",
        strokeOpacity: 1.0,
        strokeWeight: 5,
        icons: [{
            icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 4, strokeColor: "#007AFF" },
            offset: '100%'
        }],
        map: appState.map
    });

    appState.map.panTo(start);
}

window.onload = initApp;

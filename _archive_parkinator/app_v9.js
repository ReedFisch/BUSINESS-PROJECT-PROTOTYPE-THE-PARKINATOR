// Initial Credentials - Hudson Amtrak Station Area
const DEMO_LAT = 42.2526;
const DEMO_LNG = -73.7976;

const appState = {
    isParkingMode: false,
    map: null,
    parkingPolygons: [],
    navigationLine: null,
    aisleHeading: 0
};

// STRATEGY: Define the Center Line of the Driving Aisle
// This ensures perfect parallelism and prevents overlap.
// Coordinates estimated from the center of the driving lane in the "P" lot.
const AISLE_START = { lat: 42.25252, lng: -73.79765 }; // SW end of aisle
const AISLE_END = { lat: 42.25275, lng: -73.79752 }; // NE end of aisle

const AISLE_WIDTH_METERS = 7.5; // Width of the gray road part (clearance)
const SPOT_WIDTH = 2.4;
const SPOT_LENGTH = 5.0;

const GRID_COLS = 5; // Spots per row

let parkingSpots = [];

function initApp() {
    // 1. Calculate the exact angle of the driving aisle
    appState.aisleHeading = google.maps.geometry.spherical.computeHeading(AISLE_START, AISLE_END);
    console.log(`Computed Aisle Heading: ${appState.aisleHeading.toFixed(2)}`);

    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 20,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        heading: appState.aisleHeading, // Rotate map to match aisle exactly
        tilt: 0,
    });

    new google.maps.Marker({
        position: { lat: 42.2524, lng: -73.7974 },
        map: appState.map,
        title: "Hudson Amtrak Station"
    });

    document.getElementById('enable-parking-btn').addEventListener('click', enableParkingMode);
    document.getElementById('navigate-spot-btn').addEventListener('click', navigateToSpot);
}

function enableParkingMode() {
    appState.map.moveCamera({
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 21,
        tilt: 0,
        heading: appState.aisleHeading
    });

    document.getElementById('arrival-panel').classList.add('hidden');

    setTimeout(() => {
        document.getElementById('parking-panel').classList.remove('hidden');
        renderAisleRelativeGrid();
    }, 1000);
}

function renderAisleRelativeGrid() {
    // We render two rows: Left of Aisle and Right of Aisle

    // START POINTS for the rows, slightly up the aisle from the start point
    const rowStartBase = google.maps.geometry.spherical.computeOffset(AISLE_START, 5, appState.aisleHeading);

    // Row 1: Left Side
    // Center of spots is (AisleWidth/2 + SpotLength/2) to the LEFT (-90)
    const offsetDist = (AISLE_WIDTH_METERS / 2) + (SPOT_LENGTH / 2);

    const row1StartCenter = google.maps.geometry.spherical.computeOffset(
        rowStartBase,
        offsetDist,
        appState.aisleHeading - 90
    );

    // Row 2: Right Side
    // Center of spots is (AisleWidth/2 + SpotLength/2) to the RIGHT (+90)
    const row2StartCenter = google.maps.geometry.spherical.computeOffset(
        rowStartBase,
        offsetDist,
        appState.aisleHeading + 90
    );

    let spotId = 1;

    // Render Row 1
    renderRow(row1StartCenter, spotId);
    spotId += GRID_COLS;

    // Render Row 2
    renderRow(row2StartCenter, spotId);
}

function renderRow(startCenter, startId) {
    let currentCenter = startCenter;

    for (let i = 0; i < GRID_COLS; i++) {
        const id = startId + i;
        const isAvailable = (id % 2 !== 0); // Alternating availability

        const spotData = {
            id: id,
            available: isAvailable,
            center: currentCenter
        };

        parkingSpots.push(spotData);

        // Spot rotation: Perpendicular to aisle? Or Parallel?
        // Standard lots: Spots are perpendicular (90 deg) to the aisle.
        // If aisle heading is H, spot length runs H +/- 90.
        // Let's try perpendicular spots.
        // To verify "Parallel" request: User said "Vector is parallel to middle of roads".
        // This usually means the *rows* are parallel. The *spots* themselves are usually perpendicular.
        // I will draw them perpendicular to the aisle (standard parking).
        // Rotation = AisleHeading + 90 (or -90). Let's use AisleHeading + 90.
        renderSpot(spotData, currentCenter, appState.aisleHeading + 90);

        // Move to next spot ALONG the aisle (Parallel to Heading)
        currentCenter = google.maps.geometry.spherical.computeOffset(
            currentCenter,
            SPOT_WIDTH, // Moving along the aisle, step by width
            appState.aisleHeading
        );
    }
}

function renderSpot(spot, center, rotation) {
    const color = spot.available ? '#34C759' : '#FF3B30';
    // Use rotation for the rectangle
    const corners = getRectCoords(center, SPOT_WIDTH, SPOT_LENGTH, rotation);

    const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: color,
        strokeOpacity: 1.0,
        strokeWeight: 1,
        fillColor: color,
        fillOpacity: 0.4,
        map: appState.map
    });

    appState.parkingPolygons.push(polygon);
}

function getRectCoords(center, width, length, heading) {
    const diagDist = Math.sqrt((width / 2) ** 2 + (length / 2) ** 2);
    const alpha = Math.atan(width / length) * (180 / Math.PI);

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
    const available = parkingSpots.filter(s => s.available);
    if (!available.length) return;

    available.sort((a, b) => {
        const dA = google.maps.geometry.spherical.computeDistanceBetween(start, a.center);
        const dB = google.maps.geometry.spherical.computeDistanceBetween(start, b.center);
        return dA - dB;
    });

    const target = available[0].center;

    if (appState.navigationLine) appState.navigationLine.setMap(null);

    appState.navigationLine = new google.maps.Polyline({
        path: [start, target],
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

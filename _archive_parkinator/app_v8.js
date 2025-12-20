// Initial Credentials - Hudson Amtrak Station Area
const DEMO_LAT = 42.2525; // Moved South to the main lot
const DEMO_LNG = -73.7975;

const appState = {
    isParkingMode: false,
    map: null,
    parkingPolygons: [],
    navigationLine: null
};

// RELOCATED TO "HUDSON STATION" LOT (The big lot with the 'P')
// Origin: Top-Left corner of the grid within the lot
// Estimated based on map view
const LOT_START = { lat: 42.25260, lng: -73.79760 };

// Heading: Aligned with the train tracks / Front St
// Tracks run roughly NNE (approx 25 degrees)
const LOT_HEADING = 25;

const SPOT_WIDTH = 2.4;
const SPOT_LENGTH = 5.0;
const DRIVEWAY_GAP = 7.0;

const GRID_ROWS = 2;
const GRID_COLS = 6; // Wider grid for the bigger lot

let parkingSpots = [];

function initApp() {
    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 19, // Zoomed out slightly to see context
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        heading: 0,
        tilt: 0, // Top-down view for easier alignment verification first
    });

    // Station Marker
    new google.maps.Marker({
        position: { lat: 42.2524, lng: -73.7974 },
        map: appState.map,
        title: "Hudson Amtrak Station"
    });

    document.getElementById('enable-parking-btn').addEventListener('click', enableParkingMode);
    document.getElementById('navigate-spot-btn').addEventListener('click', navigateToSpot);
}

function enableParkingMode() {
    console.log("Activating Parking Mode...");

    appState.map.moveCamera({
        center: LOT_START, // Focus on the lot
        zoom: 20,
        tilt: 0, // Keep top-down for checking alignment against map footprints
        heading: 0
    });

    document.getElementById('arrival-panel').classList.add('hidden');

    setTimeout(() => {
        document.getElementById('parking-panel').classList.remove('hidden');
        generateAndRenderGrid();
    }, 1000);
}

function generateAndRenderGrid() {
    let spotIdCounter = 1;
    let currentRowStart = LOT_START;

    for (let r = 0; r < GRID_ROWS; r++) {
        let currentSpotOrigin = currentRowStart;

        for (let c = 0; c < GRID_COLS; c++) {
            const isTarget = (spotIdCounter === 8);
            const isAvailable = isTarget || (spotIdCounter % 3 === 0);

            const spotData = {
                id: spotIdCounter,
                available: isAvailable,
                center: null
            };

            // Calculate Center (Geometry Library)
            // Move Down (Length/2) then Right (Width/2)
            const centerDown = google.maps.geometry.spherical.computeOffset(currentSpotOrigin, SPOT_LENGTH / 2, LOT_HEADING);
            const center = google.maps.geometry.spherical.computeOffset(centerDown, SPOT_WIDTH / 2, LOT_HEADING + 90);

            spotData.center = center;
            parkingSpots.push(spotData);

            renderSpot(spotData, center);

            // Move Origin to the Right (Perpendicular to Heading)
            currentSpotOrigin = google.maps.geometry.spherical.computeOffset(currentSpotOrigin, SPOT_WIDTH, LOT_HEADING + 90);
            spotIdCounter++;
        }

        // Move Row Start DOWN (Parallel to Heading)
        currentRowStart = google.maps.geometry.spherical.computeOffset(currentRowStart, SPOT_LENGTH + DRIVEWAY_GAP, LOT_HEADING);
    }
}

function renderSpot(spot, center) {
    const color = spot.available ? '#34C759' : '#FF3B30';
    const corners = getRectCoords(center, SPOT_WIDTH, SPOT_LENGTH, LOT_HEADING);

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

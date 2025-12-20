// Initial Credentials - Hudson Amtrak Station Area
const DEMO_LAT = 42.25385;
const DEMO_LNG = -73.79678;

const appState = {
    isParkingMode: false,
    map: null,
    parkingPolygons: [],
    navigationLine: null
};

// PARKING LOT CONFIGURATION
// Moving "off-street" into the empty space to the West/SW of the marker
// Origin: Top-Left corner of the parking lot grid
const LOT_START = { lat: 42.25375, lng: -73.79695 };

// Heading of the parking rows (Aligned usually with building or street, let's try perpendicular to street or aligned)
// Let's keep it aligned with the street for a clean look, or 90 deg offset.
// Street is ~316. Let's make the aisles perpendicular? Or parallel. 
// Standard lots often have aisles parallel to the building.
// Let's use 316 (Parallel to street) for the ROW orientation.
const LOT_HEADING = 316;

const SPOT_WIDTH = 2.4;  // Standard width
const SPOT_LENGTH = 5.0; // Standard length
const DRIVEWAY_GAP = 7.0; // Two-way driving lane width

const GRID_ROWS = 2; // Number of rows of cars
const GRID_COLS = 4; // Cars per row

// Data will be generated dynamically
let parkingSpots = [];

function initApp() {
    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 20,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        heading: 0,
        tilt: 45,
    });

    // Station Marker
    new google.maps.Marker({
        position: { lat: DEMO_LAT, lng: DEMO_LNG },
        map: appState.map,
        title: "Hudson Amtrak Station"
    });

    document.getElementById('enable-parking-btn').addEventListener('click', enableParkingMode);
    document.getElementById('navigate-spot-btn').addEventListener('click', navigateToSpot);
}

function enableParkingMode() {
    console.log("Activating Parking MOde...");

    // Rotate map to align with the lot
    appState.map.moveCamera({
        center: LOT_START, // Focus on the lot
        zoom: 21,
        tilt: 45,
        heading: LOT_HEADING
    });

    document.getElementById('arrival-panel').classList.add('hidden');

    setTimeout(() => {
        document.getElementById('parking-panel').classList.remove('hidden');
        generateAndRenderGrid();
    }, 1000);
}

function generateAndRenderGrid() {
    let spotIdCounter = 1;

    // Row 1 (Top)
    let currentRowStart = LOT_START;

    for (let r = 0; r < GRID_ROWS; r++) {
        let currentSpotOrigin = currentRowStart;

        for (let c = 0; c < GRID_COLS; c++) {
            // Is available? Randomize slightly for demo or hardcode
            // Let's make spot #6 (in 2nd row) available for target
            const isTarget = (spotIdCounter === 6);
            const isAvailable = isTarget || (spotIdCounter % 3 === 0);

            const spotData = {
                id: spotIdCounter,
                available: isAvailable,
                center: null // to be filled
            };

            // Calculate corners
            const corners = getRectCoords(currentSpotOrigin, SPOT_WIDTH, SPOT_LENGTH, LOT_HEADING);

            // Calculate center for navigation
            // Center is offset by Length/2 and Width/2
            // Actually getRectCoords takes Top-Left? No, my previous function assumed CENTER.
            // Let's switch to a Corner-Based geometry to be precise for grids.

            // Re-implementing visually based on currentSpotOrigin being Top-Left of the spot
            /*
               TL ---- TR
               |        |
               BL ---- BR
            */
            // We need to pass the CENTER to the Polygon function if using the old getRectCoords.
            // Let's calculate the center from the origin.
            // Center = Origin + (Width/2 * 90deg) + (Length/2 * 0deg relative to heading? No)

            // Let's say Heading is "Down the Spot Length".
            // Width is "Across".

            // Let's rely on geometry library
            const centerDown = google.maps.geometry.spherical.computeOffset(currentSpotOrigin, SPOT_LENGTH / 2, LOT_HEADING);
            const center = google.maps.geometry.spherical.computeOffset(centerDown, SPOT_WIDTH / 2, LOT_HEADING + 90);

            spotData.center = center;
            parkingSpots.push(spotData);

            renderSpot(spotData, center);

            // Move Origin to the Right (Width) for next spot
            currentSpotOrigin = google.maps.geometry.spherical.computeOffset(currentSpotOrigin, SPOT_WIDTH, LOT_HEADING + 90);
            spotIdCounter++;
        }

        // Move Row Start DOWN (Length + Driveway) for next row
        // If we want rows face-to-face (standard), we might rotate 180?
        // Let's just do valid parallel rows for simplicity first, separated by lane.
        currentRowStart = google.maps.geometry.spherical.computeOffset(currentRowStart, SPOT_LENGTH + DRIVEWAY_GAP, LOT_HEADING);
    }
}

function renderSpot(spot, center) {
    const color = spot.available ? '#34C759' : '#FF3B30';

    // Use center-based rect gen
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
    // Angle to Top-Right corner relative to heading?
    // If heading is "Up/Down" (Length axis), and width is "Right/Left".
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

    // Sort by distance
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

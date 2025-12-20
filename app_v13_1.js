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

// V13.1 STRATEGY: Production Alignment
// 11.5m Separation confirmed optimal visually.
// Debug lines removed for cleaner UI.

const AISLE_START = { lat: 42.25252, lng: -73.79765 };
const AISLE_END = { lat: 42.25275, lng: -73.79752 };

const AISLE_WIDTH_METERS = 11.5;

const SPOT_WIDTH = 2.4;
const SPOT_LENGTH = 5.0;

const GRID_COLS = 5;

let parkingSpots = [];

function initApp() {
    appState.aisleHeading = google.maps.geometry.spherical.computeHeading(AISLE_START, AISLE_END);

    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 20,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        heading: appState.aisleHeading,
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
    const rowStartBase = google.maps.geometry.spherical.computeOffset(AISLE_START, 5, appState.aisleHeading);

    const lateralOffset = (AISLE_WIDTH_METERS / 2) + (SPOT_LENGTH / 2);

    // Row 1: Left
    const row1StartCenter = google.maps.geometry.spherical.computeOffset(
        rowStartBase,
        lateralOffset,
        appState.aisleHeading - 90
    );

    // Row 2: Right
    const row2StartCenter = google.maps.geometry.spherical.computeOffset(
        rowStartBase,
        lateralOffset,
        appState.aisleHeading + 90
    );

    let spotId = 1;

    renderRow(row1StartCenter, spotId, appState.aisleHeading - 90);
    spotId += GRID_COLS;

    renderRow(row2StartCenter, spotId, appState.aisleHeading + 90);
}

function renderRow(startCenter, startId, rotation) {
    let currentCenter = startCenter;

    for (let i = 0; i < GRID_COLS; i++) {
        const id = startId + i;
        const isAvailable = (id % 2 !== 0);

        const spotData = {
            id: id,
            available: isAvailable,
            center: currentCenter
        };

        parkingSpots.push(spotData);
        renderSpot(spotData, currentCenter, rotation);

        currentCenter = google.maps.geometry.spherical.computeOffset(
            currentCenter,
            SPOT_WIDTH,
            appState.aisleHeading
        );
    }
}

function renderSpot(spot, center, rotation) {
    const color = spot.available ? '#34C759' : '#FF3B30';
    const corners = getRectCoords(center, SPOT_WIDTH, SPOT_LENGTH, rotation);

    const polygon = new google.maps.Polygon({
        paths: corners,
        strokeColor: color,
        strokeOpacity: 1.0,
        strokeWeight: 1,
        fillColor: color,
        fillOpacity: 0.5,
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

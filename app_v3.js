// Initial Credentials - Using Hudson Amtrak Station
const DEMO_LAT = 42.2538;
const DEMO_LNG = -73.7968;

const appState = {
    isParkingMode: false,
    map: null,
    parkingPolygons: [],
    navigationLine: null
};

// Street Heading: Approx 322 degrees (NW) for Cross St in Hudson, NY
const STREET_HEADING = 322;

// Base anchor point for the first spot (Near the corner of projected street)
const ANCHOR_LAT = 42.25385;
const ANCHOR_LNG = -73.79675;

// Spot Dimensions in Meters (converted roughly to Lat/Lng degrees)
// Parallel Parking Spot: 2.4m wide x 6.0m long
const SPOT_WIDTH_METERS = 2.4;
const SPOT_LENGTH_METERS = 6.0;

// Helper to move a point by meters
function offsetGap(lat, lng, bearing, distanceMeters) {
    const R = 6378137; // Earth Radius in meters
    const dn = distanceMeters * Math.cos(bearing * Math.PI / 180);
    const de = distanceMeters * Math.sin(bearing * Math.PI / 180);

    // Coordinate offsets in radians
    const dLat = dn / R;
    const dLon = de / (R * Math.cos(Math.PI * lat / 180));

    // OffsetPosition, decimal degrees
    return {
        lat: lat + dLat * 180 / Math.PI,
        lng: lng + dLon * 180 / Math.PI
    };
}

// Data: 6 spots in a row along the street
const parkingSpots = [
    { id: 1, available: true },
    { id: 2, available: false },
    { id: 3, available: true },
    { id: 4, available: true }, // Target
    { id: 5, available: false },
    { id: 6, available: false },
];

function initApp() {
    appState.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 20,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        heading: 0, // Keep map North-up for clarity, or user can rotate
        tilt: 45,
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
    appState.map.moveCamera({
        center: { lat: DEMO_LAT, lng: DEMO_LNG },
        zoom: 21,
        tilt: 45,
        heading: STREET_HEADING // Rotate map to align with street!
    });

    document.getElementById('arrival-panel').classList.add('hidden');
    setTimeout(() => {
        document.getElementById('parking-panel').classList.remove('hidden');
        renderParkingSpots();
    }, 1000);
}

function getRectCoords(centerLat, centerLng, widthM, lengthM, heading) {
    // Calculate 4 corners of a rotated rectangle
    // Heading is the direction the "Length" side points to

    // Corners relative to center (bearing to corner, distance to corner)
    // Distance to corner = sqrt((w/2)^2 + (l/2)^2)
    const diagDist = Math.sqrt((widthM / 2) ** 2 + (lengthM / 2) ** 2);

    // Base angles to corners (relative to the heading axis)
    // alpha = atan((w/2) / (l/2))
    const alpha = Math.atan(widthM / lengthM) * (180 / Math.PI);

    const bearings = [
        heading + alpha,        // NE corner (relative)
        heading + 180 - alpha,  // SE
        heading + 180 + alpha,  // SW
        heading - alpha         // NW
    ];

    return bearings.map(b => offsetGap(centerLat, centerLng, b, diagDist));
}

function renderParkingSpots() {
    // Render spots in a line along the street heading
    let currentCenter = { lat: ANCHOR_LAT, lng: ANCHOR_LNG };

    // Gap between spots (virtually 0 as requested)
    const GAP_METERS = 0.2;

    parkingSpots.forEach((spot, index) => {
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
            strokeWeight: 1, // Thinner border for tighter look
            fillColor: color,
            fillOpacity: 0.4,
            map: appState.map
        });

        // Save polygon center for navigation
        spot.center = currentCenter;

        appState.parkingPolygons.push(polygon);

        // Move center to next spot position
        // Move along the street heading by Length + Gap
        currentCenter = offsetGap(
            currentCenter.lat,
            currentCenter.lng,
            STREET_HEADING,
            SPOT_LENGTH_METERS + GAP_METERS
        );
    });
}

function navigateToSpot() {
    const targetSpot = parkingSpots.find(s => s.id === 4);
    const start = { lat: DEMO_LAT, lng: DEMO_LNG };
    const end = targetSpot.center;

    const navigationPath = [start, end];

    appState.navigationLine = new google.maps.Polyline({
        path: navigationPath,
        geodesic: true,
        strokeColor: "#007AFF",
        strokeOpacity: 1.0,
        strokeWeight: 5,
        map: appState.map
    });

    appState.map.panTo(start);
}

window.onload = initApp;

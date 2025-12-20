// Map Configuration - Static Image Image
// Switched to Google Maps Style (Square 1024x1024)
const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 1024;
const IMAGE_URL = 'loomisville_map.png';

// Initialize Leaflet Map
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 2,
    zoomSnap: 0.5,
    zoomControl: false
});

const bounds = [[0, 0], [IMAGE_HEIGHT, IMAGE_WIDTH]];
const image = L.imageOverlay(IMAGE_URL, bounds).addTo(map);

// Center the map initially
map.fitBounds(bounds);

// LANDMARKS (Pixel Coordinates for Square Map)
const LOCATIONS = {
    liam: {
        coords: [512, 350], // Center-Left (Green Park)
        title: "Liam Square",
        desc: "The heart of Loomisville."
    },
    reed: {
        coords: [512, 750], // Center-Right (Train Tracks)
        title: "Reed's Rail Road",
        desc: "Central Station."
    },
    gabby: {
        coords: [800, 200], // Top-Left (Commercial Block)
        title: "Gabby's Tavern",
        desc: "Best juice in town."
    },
    cgcc: {
        coords: [200, 800], // Bottom-Right (Campus area)
        title: "Columbia Greene CC",
        desc: "School of Architecture."
    }
};

// ADD MICRO-PARKING SPOTS
// We will programmatically draw "Tiny" specific spots in the parking lot areas.
// Zones defined by [Box Center Y, Box Center X] and dimensions.
const PARKING_ZONES = [
    { center: [750, 300], rows: 4, cols: 8, vertical: false }, // Near Park - Horizontal Lots
    { center: [850, 250], rows: 4, cols: 6, vertical: true },  // Near Tavern - Vertical Lots
    { center: [300, 300], rows: 3, cols: 10, vertical: false }, // Left Side
    { center: [350, 850], rows: 5, cols: 8, vertical: true }   // College Lot
];

const SPOT_SIZE_PX = 8; // "Really Tiny" pixels
const GAP_PX = 2;

PARKING_ZONES.forEach(zone => {
    drawParkingGrid(zone);
});

function drawParkingGrid(zone) {
    const { center, rows, cols, vertical } = zone;
    const [centerY, centerX] = center;

    // Calculate starting top-left to center the grid
    const gridWidth = cols * (SPOT_SIZE_PX + GAP_PX);
    const gridHeight = rows * (SPOT_SIZE_PX + GAP_PX);

    const startY = centerY + (gridHeight / 2); // Leaflet Y goes up? No, ImageOverlay [0,0] is bottom-left usually.
    const startX = centerX - (gridWidth / 2);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const y = startY - (r * (SPOT_SIZE_PX + GAP_PX));
            const x = startX + (c * (SPOT_SIZE_PX + GAP_PX));

            // Define corners for rectangle
            // If vertical, swap width/length logic if needed, but here simple grid.
            const bounds = [
                [y, x],
                [y - SPOT_SIZE_PX, x + SPOT_SIZE_PX]
            ];

            L.rectangle(bounds, {
                color: "white",
                weight: 0.5,
                fillColor: "#34C759", // Tiny Green "Available" Spots
                fillOpacity: 0.6
            }).addTo(map);
        }
    }
}

// Add Markers
Object.keys(LOCATIONS).forEach(key => {
    const loc = LOCATIONS[key];

    // Custom "Google Maps" Pin
    const pinIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="
            background-color: #EA4335;
            width: 30px; 
            height: 40px; 
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 2px 2px 4px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <div style="
                width: 14px; 
                height: 14px; 
                background:white; 
                border-radius:50%;
                transform: rotate(45deg);
            "></div>
        </div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -40]
    });

    const marker = L.marker(loc.coords, { icon: pinIcon }).addTo(map);

    // Google Maps Style Info Window
    marker.bindPopup(`
        <div style="font-family: Roboto, Arial; min-width: 150px;">
            <h3 style="margin: 0; color: #202124;">${loc.title}</h3>
            <div style="color: #E67C00; font-size: 13px; margin: 4px 0;">4.8 ★★★★★</div>
            <p style="margin: 0; color: #5F6368; font-size: 13px;">${loc.desc}</p>
        </div>
    `);
});

// Pan Function
window.panToPlace = (key) => {
    const loc = LOCATIONS[key];
    if (loc) {
        map.flyTo(loc.coords, 1); // Zoom level 1
    }
};

// Standard Zoom Control (Bottom Right like GMaps)
L.control.zoom({ position: 'bottomright' }).addTo(map);

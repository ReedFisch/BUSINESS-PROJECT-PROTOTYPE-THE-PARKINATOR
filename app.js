// Map Configuration - 4-Sector Mega Map (2x2 Grid)
// Total World 3584 x 2048.
// [0,0] is Bottom-Left (SW corner of SW sector).

const IMAGE_WIDTH = 3584; // 1792 * 2
const IMAGE_HEIGHT = 2048; // 1024 * 2

// Initialize Leaflet Map
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    zoomSnap: 0.5,
    zoomControl: false
});

// Define Bounds for 4 Sectors (2x2)
// [Y, X] in Leaflet Simple.
// SW Sector: Bottom-Left (0,0) -> (1024, 1792)
const boundsSW = [[0, 0], [1024, 1792]];
// SE Sector: Bottom-Right (0, 1792) -> (1024, 3584)
const boundsSE = [[0, 1792], [1024, 3584]];
// NW Sector: Top-Left (1024, 0) -> (2048, 1792)
const boundsNW = [[1024, 0], [2048, 1792]];
// NE Sector: Top-Right (1024, 1792) -> (2048, 3584)
const boundsNE = [[1024, 1792], [2048, 3584]];

// Add Overlays
L.imageOverlay('loomisville_sec_sw.png', boundsSW).addTo(map);
L.imageOverlay('loomisville_sec_se.png', boundsSE).addTo(map);
L.imageOverlay('loomisville_sec_nw.png', boundsNW).addTo(map);
L.imageOverlay('loomisville_sec_ne.png', boundsNE).addTo(map);

// Center on Mullins Square (Ideally in NW sector)
map.setView([1500, 900], -1);

// LANDMARKS
const LOCATIONS = {
    mullins: {
        coords: [1536, 896], // Center of NW Sector (1024 + 512, 896)
        title: "Mullins Square",
        desc: "The heart of Loomisville (NW)."
    },
    shops: {
        coords: [1500, 2700], // Center of NE Sector
        title: "Shopping District",
        desc: "Major commercial hub (NE)."
    },
    reed: {
        coords: [512, 896], // Center of SW Sector
        title: "Reed's Rail Road",
        desc: "Central Station (SW)."
    },
    cgcc: {
        coords: [512, 2700], // Center of SE Sector
        title: "Columbia Greene CC",
        desc: "School of Architecture (SE)."
    }
};

// ADD MICRO-PARKING SPOTS - 2x2 Grid
const PARKING_ZONES = [
    // NW Sector (Mullins)
    { center: [1800, 300], rows: 5, cols: 8, vertical: false },
    { center: [1300, 1500], rows: 4, cols: 10, vertical: false },

    // NE Sector (Shops)
    { center: [1600, 2200], rows: 6, cols: 12, vertical: true }, // Big Mall Lot
    { center: [1900, 3200], rows: 4, cols: 8, vertical: false },

    // SW Sector (Rail)
    { center: [800, 600], rows: 3, cols: 20, vertical: false }, // Station Parking

    // SE Sector (Campus)
    { center: [300, 2500], rows: 8, cols: 8, vertical: true }   // Campus Main Lot
];

const SPOT_SIZE_PX = 10;
const GAP_PX = 3;

PARKING_ZONES.forEach(zone => {
    drawParkingGrid(zone);
});

function drawParkingGrid(zone) {
    const { center, rows, cols, vertical } = zone;
    const [centerY, centerX] = center;

    const gridWidth = cols * (SPOT_SIZE_PX + GAP_PX);
    const gridHeight = rows * (SPOT_SIZE_PX + GAP_PX);

    const startY = centerY + (gridHeight / 2);
    const startX = centerX - (gridWidth / 2);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const y = startY - (r * (SPOT_SIZE_PX + GAP_PX));
            const x = startX + (c * (SPOT_SIZE_PX + GAP_PX));

            const bounds = [
                [y, x],
                [y - SPOT_SIZE_PX, x + SPOT_SIZE_PX]
            ];

            L.rectangle(bounds, {
                color: "white",
                weight: 0.5,
                fillColor: "#34C759", // Available
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
        map.flyTo(loc.coords, 0.5); // Zoom slightly out to show context
    }
};

// Standard Zoom Control (Bottom Right like GMaps)
L.control.zoom({ position: 'bottomright' }).addTo(map);

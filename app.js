// Map Configuration - Mega Map (Two Sectors Stitched)
// Sector A (West): loomisville_sector_west.png (1792x1024)
// Sector B (East): loomisville_sector_east.png (1792x1024)
// Total Width: 3584, Total Height: 1024

const IMAGE_HEIGHT = 1024;
const IMAGE_WIDTH = 3584; // 1792 * 2

// Initialize Leaflet Map
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 2,
    zoomSnap: 0.5,
    zoomControl: false
});

// Define Bounds for Sectors
// West is 0 to 1792
// East is 1792 to 3584
const boundsWest = [[0, 0], [IMAGE_HEIGHT, 1792]];
const boundsEast = [[0, 1792], [IMAGE_HEIGHT, 3584]];

// Add Overlays
L.imageOverlay('loomisville_sector_west.png', boundsWest).addTo(map);
L.imageOverlay('loomisville_sector_east.png', boundsEast).addTo(map);

// Center the map initially on the "Seam" - Mullins Square
map.setView([512, 1000], 0);
map.fitBounds(boundsWest); // Start focused on downtown

// LANDMARKS (Pixel Coordinates for Mega Map)
// West Sector (0-1792)
// East Sector (1792-3584)

const LOCATIONS = {
    mullins: {
        coords: [500, 896], // Center of West Sector (Mullins Square)
        title: "Mullins Square", // RENAMED from Liam Square
        desc: "The heart of Loomisville."
    },
    gabby: {
        coords: [800, 400], // Top-Left of West Sector
        title: "Gabby's Tavern",
        desc: "Best juice in town."
    },
    reed: {
        coords: [300, 2500], // Bottom-Center of East Sector (1792 + 700ish)
        title: "Reed's Rail Road",
        desc: "Central Station."
    },
    cgcc: {
        coords: [800, 3200], // Top-Right of East Sector (1792 + 1400ish)
        title: "Columbia Greene CC",
        desc: "School of Architecture."
    }
};

// ADD MICRO-PARKING SPOTS
// Adjusted for the new layout.
// West Sector Parking (Offsets 0-1792)
const PARKING_ZONES = [
    { center: [850, 1100], rows: 4, cols: 8, vertical: true },   // West Lot 1
    { center: [250, 1200], rows: 3, cols: 12, vertical: false }, // West Lot 2
    { center: [600, 300], rows: 6, cols: 6, vertical: false },   // West Lot 3

    // East Sector Parking (Offsets > 1792)
    { center: [400, 2700], rows: 2, cols: 15, vertical: false }, // East Station Parking
    { center: [700, 3300], rows: 5, cols: 8, vertical: true }    // East College Parking
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

// Map Configuration - Static Image Image
// New Widescreen High-Res Map
const IMAGE_WIDTH = 1792;
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

// LANDMARKS (Pixel Coordinates)
// Estimating positions on the 1792x1024 grid
// [y, x] format (Leaflet Simple CRS usually treats [0,0] as bottom-left, but imageOverlay bounds might flip it depending on config.
// Standard Leaflet ImageOverlay: [0,0] is top-left in pixel coords if we map it that way, but let's stick to the bounds [0,0] to [H,W].
// So [0,0] is bottom-left. [1024, 1792] is top-right.

const LOCATIONS = {
    liam: {
        coords: [512, 896], // Center (The Park)
        title: "Liam Square",
        desc: "The heart of Loomisville."
    },
    reed: {
        coords: [300, 1400], // Bottom-Right-ish (Train Station area)
        title: "Reed's Rail Road",
        desc: "Central Station."
    },
    gabby: {
        coords: [400, 400], // Bottom-Left (Tavern/Town)
        title: "Gabby's Tavern",
        desc: "Best juice in town."
    },
    cgcc: {
        coords: [800, 1500], // Top-Right (College)
        title: "Columbia Greene CC",
        desc: "School of Architecture."
    }
};

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

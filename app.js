let map;

// LOCATIONS (Hudson, NY area re-mapped to Loomisville)
const LOCATIONS = {
    // 1. LIAM SQUARE (7th Street Park - High St/Columbia St)
    // A nice green square in Hudson.
    liam: {
        position: { lat: 42.2494, lng: -73.7915 },
        title: "Liam Square",
        emoji: "🌳",
        zoom: 19,
        heading: 45,
        tilt: 60
    },
    // 2. REED'S RAIL ROAD (Hudson Amtrak Station)
    reed: {
        position: { lat: 42.2524, lng: -73.7974 },
        title: "Reed's Rail Road",
        emoji: "🚂",
        zoom: 18,
        heading: 25, // Align with tracks
        tilt: 65
    },
    // 3. GABBY'S TAVERN (A spot on Warren St, e.g., near 3rd St)
    gabby: {
        position: { lat: 42.2505, lng: -73.7930 },
        title: "Gabby's Tavern",
        emoji: "🍻",
        zoom: 20,
        heading: 315, // Look down the street
        tilt: 50
    },
    // 4. COLUMBIA GREENE COMMUNITY COLLEGE (Real Location)
    // It's actually a bit further out (Greenport).
    cgcc: {
        position: { lat: 42.2285, lng: -73.7770 },
        title: "CGCC",
        emoji: "🎓",
        zoom: 17,
        heading: 0,
        tilt: 45
    }
};

async function initMap() {
    // Import libraries
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    // Initialize Map with 3D Vector options
    map = new Map(document.getElementById("map"), {
        center: LOCATIONS.reed.position,
        zoom: 17,
        mapId: "DEMO_MAP_ID", // Required for Vector 3D
        heading: 320,
        tilt: 60,
        disableDefaultUI: true,
        backgroundColor: "#87CEEB", // Sky blue loading background
    });

    // Create Markers for each Landmark
    Object.keys(LOCATIONS).forEach(key => {
        const loc = LOCATIONS[key];
        createCustomMarker(loc, AdvancedMarkerElement);
    });

    // Start a slow rotation animation for vibes
    startRotation();
}

function createCustomMarker(locationConfig, AdvancedMarkerElement) {
    // Create DOM element for the marker content
    const div = document.createElement('div');
    div.className = 'custom-marker';
    div.innerHTML = `
        <span class="marker-emoji">${locationConfig.emoji}</span>
        <div class="marker-label">${locationConfig.title}</div>
    `;

    new AdvancedMarkerElement({
        map: map,
        position: locationConfig.position,
        content: div,
        title: locationConfig.title
    });
}

// Global flyTo function for buttons
window.flyTo = (key) => {
    const loc = LOCATIONS[key];
    if (!loc || !map) return;

    map.moveCamera({
        center: loc.position,
        zoom: loc.zoom,
        heading: loc.heading,
        tilt: loc.tilt
    });
};

function startRotation() {
    // Rotate 0.5 degrees every frame for a cinematic feel
    // Only if not interacting? Let's just do a slow drift.
    // Actually, constant rotation can be annoying if user tries to pan.
    // Let's leave it manual for now, or just an initial spin.
}

window.onload = initMap;

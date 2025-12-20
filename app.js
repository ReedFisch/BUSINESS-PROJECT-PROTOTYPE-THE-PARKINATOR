/* The Parkinator - Real World Edition */
/* Integrates Google Maps API + LADOT Open Data (Live Viewport Filtering) */

let map;
let allMarkers = [];
const ZOOM_THRESHOLD = 16;
const API_ENDPOINT = 'https://data.lacity.org/resource/s49e-q6j2.json';

window.initMap = async function () {
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

    const position = { lat: 34.0522, lng: -118.2437 };

    map = new Map(document.getElementById("map"), {
        zoom: 16,
        center: position,
        mapId: "DEMO_MAP_ID",
        tilt: 0,
    });

    const statsDiv = document.getElementById('stats');

    // Listener: IDLE (When map stops moving)
    map.addListener('idle', () => {
        const zoom = map.getZoom();

        if (zoom < ZOOM_THRESHOLD) {
            clearMarkers();
            statsDiv.innerHTML = `<span style="color:#D32F2F">Zoom in to see parking filters.</span><br>(Current Zoom: ${zoom} < ${ZOOM_THRESHOLD})`;
        } else {
            // Get visible bounds
            const bounds = map.getBounds();
            if (bounds) {
                const ne = bounds.getNorthEast();
                const sw = bounds.getSouthWest();

                // SoQL within_box(field, nw_lat, nw_long, se_lat, se_long)
                // NW Lat = NE Lat (top), NW Lng = SW Lng (left)
                // SE Lat = SW Lat (bottom), SE Lng = NE Lng (right)

                const nwLat = ne.lat();
                const nwLng = sw.lng();
                const seLat = sw.lat();
                const seLng = ne.lng();

                fetchParkingInBounds(nwLat, nwLng, seLat, seLng, AdvancedMarkerElement);
            }
        }
    });

    // Initial Fetch (if starting at high zoom)
    google.maps.event.trigger(map, 'idle');
};

async function fetchParkingInBounds(nwLat, nwLng, seLat, seLng, AdvancedMarkerElement) {
    const statsDiv = document.getElementById('stats');
    statsDiv.textContent = "Fetching live data...";

    // Construct SoQL Query
    // $where=within_box(lat_long, nwLat, nwLng, seLat, seLng)
    // Note: Socrata `within_box` expects (lat_long, nw_lat, nw_long, se_lat, se_long)
    const query = `?$where=within_box(lat_long, ${nwLat}, ${nwLng}, ${seLat}, ${seLng}) AND spaceid IS NOT NULL`;
    const url = `${API_ENDPOINT}${query}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`LADOT API Error: ${response.status}`);

        const data = await response.json();

        clearMarkers(); // Clear old viewport markers before showing new ones
        renderMarkers(data, AdvancedMarkerElement);

        statsDiv.textContent = `Found ${data.length} meters in view.`;

    } catch (error) {
        console.error("Fetch Error:", error);
        statsDiv.innerHTML = `<span style="color:red">Error loading data.</span><br>Ensure Local Server is running at http://localhost:8080`;
    }
}

function clearMarkers() {
    allMarkers.forEach(marker => marker.map = null);
    allMarkers = [];
}

function renderMarkers(data, AdvancedMarkerElement) {
    // Shared Icon Template
    const starSvg = document.createElement('div');
    starSvg.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
                  fill="#FFAE00" stroke="#FFFFFF" stroke-width="1.5"/>
        </svg>
    `;

    data.forEach(meter => {
        let lat, lng;

        if (meter.lat_long && meter.lat_long.latitude) {
            lat = parseFloat(meter.lat_long.latitude);
            lng = parseFloat(meter.lat_long.longitude);
        } else if (meter.latitude && meter.longitude) {
            lat = parseFloat(meter.latitude);
            lng = parseFloat(meter.longitude);
        }

        if (lat && lng) {
            const icon = starSvg.cloneNode(true);
            const marker = new AdvancedMarkerElement({
                map: map,
                position: { lat: lat, lng: lng },
                title: `ID: ${meter.spaceid}`,
                content: icon
            });
            allMarkers.push(marker);
        }
    });
}

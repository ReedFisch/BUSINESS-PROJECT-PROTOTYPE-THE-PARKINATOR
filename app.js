/* The Parkinator - Real World Edition */
/* Strategy: Local DB + Pricing + Reservations */

let map;
let allMarkers = [];
let parkingDatabase = [];
const ZOOM_THRESHOLD = 15;
let activeInfoWindow = null;

window.initMap = async function () {
    const { Map, InfoWindow } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    const position = { lat: 34.0522, lng: -118.2437 };

    map = new Map(document.getElementById("map"), {
        zoom: 16,
        center: position,
        mapId: "DEMO_MAP_ID",
        tilt: 0,
        disableDefaultUI: true,
        zoomControl: true,
    });

    activeInfoWindow = new InfoWindow();

    const statsDiv = document.getElementById('stats');
    statsDiv.textContent = "Loading local database...";

    // LOAD DATABASE
    try {
        const response = await fetch('parking_database.json');
        if (!response.ok) throw new Error("Local DB not found.");
        parkingDatabase = await response.json();

        parkingDatabase.forEach(meter => {
            const rand = Math.random();
            if (rand < 0.45) meter.status = 'taken';
            else if (rand < 0.60) meter.status = 'soon';
            else meter.status = 'free';

            let price = 0;
            if (meter.raterange) {
                const match = meter.raterange.match(/\$?(\d+(\.\d{2})?)/);
                if (match) price = parseFloat(match[1]);
            }
            meter.priceVal = price;
        });

        console.log(`Database loaded: ${parkingDatabase.length} records.`);
        statsDiv.textContent = `DB Ready.`;

        updateMap(AdvancedMarkerElement);

    } catch (err) {
        console.error("DB Load Error:", err);
        return;
    }

    map.addListener('idle', () => updateMap(AdvancedMarkerElement));
};

let cheapestMeterInView = null;

window.navigateToCheapest = () => {
    if (cheapestMeterInView) {
        const lat = parseFloat(cheapestMeterInView.latlng.latitude);
        const lng = parseFloat(cheapestMeterInView.latlng.longitude);
        map.panTo({ lat, lng });
        map.setZoom(19);
    } else {
        alert("No available parking in view!");
    }
};

// Reservation Logic
window.handleReserve = (spaceId, type) => {
    // Find meter
    const meter = parkingDatabase.find(m => m.spaceid === spaceId);
    if (!meter) return;

    if (type === 'now') {
        alert(`SUCCESS!\n\nSpace ${spaceId} Reserved for 15 minutes.\n$${meter.priceVal} charged.`);
        meter.status = 'reserved'; // New status
    } else if (type === 'later') {
        const time = prompt("Enter reservation time (e.g. 6:00 PM):", "6:00 PM");
        if (time) {
            alert(`CONFIRMED.\n\nSpace ${spaceId} reserved for ${time}.`);
            meter.status = 'scheduled'; // New status
        } else {
            return;
        }
    }

    // Refresh Map to show new color
    activeInfoWindow.close();
    // Re-render
    clearMarkers();
    // We need to re-fetch AdvancedMarkerElement class reference... 
    // Simplified: Just trigger 'idle' or call render directly if we stored the class
    google.maps.importLibrary("marker").then(({ AdvancedMarkerElement }) => {
        const bounds = map.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const visibleMeters = parkingDatabase.filter(m => {
            if (!m.latlng) return false;
            const lat = parseFloat(m.latlng.latitude);
            const lng = parseFloat(m.latlng.longitude);
            return lat >= sw.lat() && lat <= ne.lat() && lng >= sw.lng() && lng <= ne.lng();
        });
        renderMarkers(visibleMeters, AdvancedMarkerElement);
        // Refresh stats
        const statsDiv = document.getElementById('stats');
        updateStats(visibleMeters, statsDiv);
    });
};


function updateMap(AdvancedMarkerElement) {
    const statsDiv = document.getElementById('stats');
    const zoom = map.getZoom();

    if (zoom < ZOOM_THRESHOLD) {
        clearMarkers();
        statsDiv.innerHTML = `<div style="text-align:center;">Zoom In</div>`;
        return;
    }

    const bounds = map.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const visibleMeters = parkingDatabase.filter(meter => {
        if (!meter.latlng) return false;
        const lat = parseFloat(meter.latlng.latitude);
        const lng = parseFloat(meter.latlng.longitude);
        return lat >= sw.lat() && lat <= ne.lat() && lng >= sw.lng() && lng <= ne.lng();
    });

    clearMarkers();
    renderMarkers(visibleMeters, AdvancedMarkerElement);
    updateStats(visibleMeters, statsDiv);
}

function updateStats(meters, container) {
    if (meters.length === 0) {
        container.innerHTML = "No parking found.";
        cheapestMeterInView = null;
        return;
    }

    const available = meters.filter(m => m.status === 'free');

    // Find Cheapest
    let minPrice = Infinity;
    cheapestMeterInView = null;
    available.forEach(m => {
        if (m.priceVal > 0 && m.priceVal < minPrice) {
            minPrice = m.priceVal;
            cheapestMeterInView = m;
        }
    });
    const cheapDisp = minPrice !== Infinity ? `$${minPrice.toFixed(2)}` : "--";

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <div><small>VISIBLE</small> <b>${meters.length}</b></div>
            <div style="text-align:right;"><small>FREE</small> <b style="color:#34C759;">${available.length}</b></div>
        </div>
        <div style="background:#e8f0fe; padding:10px; border-radius:8px; text-align:center;">
             <div style="font-size:10px; text-transform:uppercase; color:#1967d2;">Cheapest Nearby</div>
             <div style="font-size:24px; font-weight:900; color:#1967d2;">${cheapDisp}</div>
             <button onclick="navigateToCheapest()" style="
                background: #1967d2; border:none; color:white; padding:6px 12px; border-radius:100px; cursor:pointer; font-weight:bold;
             ">Navigate to Meter</button>
        </div>
    `;
}

function clearMarkers() {
    allMarkers.forEach(marker => marker.map = null);
    allMarkers = [];
}

function renderMarkers(data, AdvancedMarkerElement) {
    const MAX_RENDER = 1000;
    const renderData = data.slice(0, MAX_RENDER);

    renderData.forEach(meter => {
        const lat = parseFloat(meter.latlng.latitude);
        const lng = parseFloat(meter.latlng.longitude);

        let color = "#34C759"; // Green
        let zIndex = 3;

        if (meter.status === 'taken') {
            color = "#EA4335"; // Red
            zIndex = 1;
        } else if (meter.status === 'soon') {
            color = "#FBBC04"; // Yellow
            zIndex = 2;
        } else if (meter.status === 'reserved') {
            color = "#1A73E8"; // Blue (Reserved)
            zIndex = 4;
        } else if (meter.status === 'scheduled') {
            color = "#9334E6"; // Purple (Scheduled)
            zIndex = 4;
        }

        let priceLabel = "";
        if (meter.priceVal > 0 && meter.status !== 'taken') {
            priceLabel = `<div style="
                background: white; padding: 1px 4px; border-radius: 4px; font-size: 10px; font-weight: bold; color: #333; 
                box-shadow: 0 1px 2px rgba(0,0,0,0.2); margin-bottom: 2px; white-space: nowrap; position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
            ">$${meter.priceVal.toFixed(2)}</div>`;
        }

        const iconContainer = document.createElement('div');
        iconContainer.style.position = 'relative';
        iconContainer.innerHTML = `
            ${priceLabel}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; margin:auto;">
                <circle cx="8" cy="8" r="6" fill="${color}" stroke="white" stroke-width="2"/>
            </svg>
        `;

        const marker = new AdvancedMarkerElement({
            map: map,
            position: { lat: lat, lng: lng },
            title: `ID: ${meter.spaceid}`,
            content: iconContainer,
            zIndex: zIndex
        });

        // Click Logic
        if (meter.status === 'free' || meter.status === 'soon') {
            iconContainer.style.cursor = "pointer"; // Hand cursor
            marker.addListener('click', () => {
                const contentStr = `
                    <div style="font-family:Roboto,sans-serif; min-width:200px;">
                        <h3 style="margin:0 0 8px 0; font-size:16px;">Space ${meter.spaceid}</h3>
                        <p style="margin:0 0 8px 0; color:#555;">
                            Rate: <b>$${meter.priceVal || 'N/A'}</b><br>
                            Limit: ${meter.timelimit || 'N/A'}
                        </p>
                        <div style="display:flex; gap:8px;">
                            <button onclick="window.handleReserve('${meter.spaceid}', 'now')" style="
                                background:#1A73E8; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold; flex:1;
                            ">Reserve Now</button>
                            <button onclick="window.handleReserve('${meter.spaceid}', 'later')" style="
                                background:#f1f3f4; color:#3c4043; border:1px solid #dadce0; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold; flex:1;
                            ">Later</button>
                        </div>
                    </div>
                `;
                activeInfoWindow.setContent(contentStr);
                activeInfoWindow.open({
                    anchor: marker,
                    map,
                });
            });
        }

        allMarkers.push(marker);
    });
}

if (window.google && window.google.maps) {
    initMap();
} else {
    window.addEventListener('load', () => {
        if (window.google && window.google.maps) {
            initMap();
        }
    });
}

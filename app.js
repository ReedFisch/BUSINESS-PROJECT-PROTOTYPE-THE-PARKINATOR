/* The Parkinator - Real World Edition */
/* Strategy: Local DB + Simulated Availability + Price Labels + Navigation */

let map;
let allMarkers = [];
let parkingDatabase = [];
const ZOOM_THRESHOLD = 15;

window.initMap = async function () {
    const { Map } = await google.maps.importLibrary("maps");
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

    const statsDiv = document.getElementById('stats');
    statsDiv.textContent = "Loading local database...";

    // LOAD DATABASE
    try {
        const response = await fetch('parking_database.json');
        if (!response.ok) throw new Error("Local DB not found.");
        parkingDatabase = await response.json();

        // PRE-PROCESS
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
        statsDiv.textContent = `DB Ready: ${parkingDatabase.length} loaded.`;

        updateMap(AdvancedMarkerElement);

    } catch (err) {
        console.error("DB Load Error:", err);
        statsDiv.innerHTML = `<span style="color:red">Failed to load local DB.</span>`;
        return;
    }

    map.addListener('idle', () => updateMap(AdvancedMarkerElement));
};

// Global reference to the cheapest meter for navigation
let cheapestMeterInView = null;

window.navigateToCheapest = () => {
    if (cheapestMeterInView) {
        const lat = parseFloat(cheapestMeterInView.latlng.latitude);
        const lng = parseFloat(cheapestMeterInView.latlng.longitude);

        map.panTo({ lat, lng });
        map.setZoom(19); // Zoom right in

        // Optional: Add a bounce animation or highlight? 
        // For now, simple navigation is fine.
    } else {
        alert("No available parking in view!");
    }
};

function updateMap(AdvancedMarkerElement) {
    const statsDiv = document.getElementById('stats');
    const zoom = map.getZoom();

    if (zoom < ZOOM_THRESHOLD) {
        clearMarkers();
        statsDiv.innerHTML = `<div style="text-align:center;">Zoom In<br><small>to see prices</small></div>`;
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

    // Render
    clearMarkers();
    renderMarkers(visibleMeters, AdvancedMarkerElement);

    // Stats & Navigation Logic
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
            <div>
                <small style="color:#666;">VISIBLE</small>
                <div style="font-weight:bold;">${meters.length}</div>
            </div>
            <div style="text-align:right;">
                <small style="color:#666;">FREE</small>
                <div style="font-weight:bold; color:#34C759;">${available.length}</div>
            </div>
        </div>
        
        <div style="background:#e8f0fe; padding:10px; border-radius:8px; text-align:center;">
             <div style="font-size:10px; text-transform:uppercase; color:#1967d2; font-weight:bold;">Cheapest Nearby</div>
             <div style="font-size:24px; font-weight:900; color:#1967d2; margin:5px 0;">${cheapDisp}</div>
             <button onclick="navigateToCheapest()" style="
                background: #1967d2; border:none; color:white; 
                padding:6px 12px; border-radius:100px; font-size:12px; cursor:pointer; font-weight:bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
             ">
                Navigate to Meter
             </button>
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

        // Color Logic
        let color = "#34C759"; // Green
        let zIndex = 3;

        if (meter.status === 'taken') {
            color = "#EA4335"; // Red
            zIndex = 1;
        } else if (meter.status === 'soon') {
            color = "#FBBC04"; // Yellow
            zIndex = 2;
        }

        // Price Text
        // Only show price text if it's NOT taken (Taken spots don't matter)
        // Or show on all? User said "above each meter".
        let priceLabel = "";
        if (meter.priceVal > 0) {
            priceLabel = `<div style="
                background: white; 
                padding: 1px 4px; 
                border-radius: 4px; 
                font-size: 10px; 
                font-weight: bold; 
                color: #333; 
                box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                margin-bottom: 2px;
                white-space: nowrap;
                position: absolute;
                bottom: 14px;
                left: 50%;
                transform: translateX(-50%);
            ">$${meter.priceVal.toFixed(2)}</div>`;
        }

        const iconContainer = document.createElement('div');
        iconContainer.style.position = 'relative';

        // HTML Structure for Custom Marker
        iconContainer.innerHTML = `
            ${priceLabel}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; margin:auto;">
                <circle cx="8" cy="8" r="6" fill="${color}" stroke="white" stroke-width="2"/>
            </svg>
        `;

        const marker = new AdvancedMarkerElement({
            map: map,
            position: { lat: lat, lng: lng },
            title: `ID: ${meter.spaceid} - $${meter.priceVal}`,
            content: iconContainer,
            zIndex: zIndex
        });
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

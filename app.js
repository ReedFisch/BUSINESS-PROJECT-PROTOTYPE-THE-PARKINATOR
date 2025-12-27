/* The Parkinator - Real World Edition (v4) */
window.onerror = function (msg, url, line) {
    const el = document.getElementById('stats');
    if (el) el.innerHTML = `<div style="background:#ffcccc;color:red;padding:10px;border-radius:8px;"><b>Error:</b> ${msg}<br>Line: ${line}</div>`;
};
console.log("App v4 starting...");
/* Strategy: Local DB + Pricing + Multi-Reservations + WorldTimeAPI + Mobile UX */

let map;
let allMarkers = [];
let parkingDatabase = [];
const ZOOM_THRESHOLD = 15;
const PRICE_VISIBILITY_ZOOM = 16; // Approx. 0.5 mile view on mobile

let activeInfoWindow = null;
let destinationMarker = null;
window.searchDestination = null;


// State - Load from localStorage
let isPremium = localStorage.getItem('loomis_premium') === 'true';

// Initialize premium UI on load
window.addEventListener('load', () => {
    updatePremiumUI();
});

function updatePremiumUI() {
    const statusEl = document.getElementById('premium-status');
    const btnEl = document.getElementById('premium-btn');


    if (statusEl) {
        statusEl.innerHTML = isPremium
            ? 'Status: <b style="color:#d93025;">Premium 💎</b>'
            : 'Status: <b>Free</b>';
    }
    if (btnEl) {
        btnEl.innerText = isPremium ? '✓ Premium Active' : '💎 Upgrade ($5)';
        btnEl.style.background = isPremium ? '#34a853' : '#fbbc04';
    }

}




// Track Multiple User Reservations
let myReservations = []; // { spaceid, type, lat, lng, time, price, startTime }

window.initMap = async function () {
    const { Map, InfoWindow } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    GlobalMarkerElement = AdvancedMarkerElement;

    const position = { lat: 34.0522, lng: -118.2437 };

    map = new Map(document.getElementById("map"), {
        zoom: 16,
        center: position,
        mapId: "DEMO_MAP_ID",
        tilt: 0,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy", // ENABLE ONE-FINGER PAN ON MOBILE
    });

    // SEARCH & PLACES SETUP
    const input = document.getElementById("pac-input");
    const uiContainer = document.getElementById("top-left-container");
    uiContainer.style.display = "flex"; // Make visible when map loads

    const { Autocomplete } = await google.maps.importLibrary("places");
    const autocomplete = new Autocomplete(input);
    autocomplete.bindTo("bounds", map);

    // Push ENTIRE UI Container to Top-Left
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(uiContainer);



    autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
            window.alert("No details available for input: '" + place.name + "'");
            return;
        }

        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }

        // Drop Destination Pin
        if (destinationMarker) destinationMarker.map = null;

        // Simple red pin for destination
        const pinView = new google.maps.marker.PinElement({
            background: "#DB4437",
            borderColor: "#C5221F",
            glyphColor: "white",
        });

        destinationMarker = new AdvancedMarkerElement({
            map,
            position: place.geometry.location,
            content: pinView.element,
            title: place.name,
        });

        // PERSIST LOCATION
        window.searchDestination = place.geometry.location;

        // UPDATE UI (Don't auto-nav)
        const statsDiv = document.getElementById('stats');
        statsDiv.innerHTML = `
            <div class="smart-find-box">
                 <div class="sf-label">Selected Location</div>
                 <div class="sf-title">${place.name}</div>
                 <div style="display:flex; gap:8px;">
                      <button onclick="navigateToClosest()" class="nav-btn-light">📍 Closest</button>
                      <button onclick="navigateToCheapest()" class="nav-btn-blue">💲 Cheapest</button>
                 </div>
                 <div style="margin-top:8px; font-size:10px; color:#666;">*Looking near pin</div>
            </div>
        `;
    });

    activeInfoWindow = new InfoWindow();

    const statsDiv = document.getElementById('stats');
    statsDiv.textContent = "Fetching data (v4)...";

    // LOAD DATABASE
    try {
        const response = await fetch('parking_min.json');
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

// SMART NAV LOGIC


window.navigateToReservation = (index) => {
    if (myReservations[index]) {
        const res = myReservations[index];
        map.panTo({ lat: res.lat, lng: res.lng });
        map.setZoom(19);
    }
};

// BILLING LOGIC
window.endReservation = (index) => {
    if (!myReservations[index]) return;

    const res = myReservations[index];
    const duration = 15 + Math.floor(Math.random() * 45); // Simulate duration minutes
    const totalCost = res.price; // Flat rate for demo, could be per hour

    // 1. Show Bill
    const billMsg = `
    🧾 YOUR RECEIPT
    ----------------------------
    Space ID: ${res.spaceid}
    Duration: ${duration} mins
    ----------------------------
    TOTAL PAID: $${totalCost.toFixed(2)}
    ----------------------------
    Thank you for using Parkinator!
    `;
    alert(billMsg);

    // 2. Free up the spot in local DB
    const meter = parkingDatabase.find(m => m.spaceid === res.spaceid);
    if (meter) {
        meter.status = 'free';
    }

    // 3. Remove from array
    myReservations.splice(index, 1);

    // 4. Refresh UI
    google.maps.importLibrary("marker").then(({ AdvancedMarkerElement }) => {
        updateMap(AdvancedMarkerElement);
    });
};

// Trusted Time API
async function getTrustedTime() {
    try {
        const response = await fetch("https://worldtimeapi.org/api/timezone/America/Los_Angeles");
        const data = await response.json();
        return new Date(data.datetime);
    } catch (e) {
        console.warn("Time API failed, falling back to local time.", e);
        return new Date();
    }
}

async function getTimePlusHoursStr(hours) {
    const d = await getTrustedTime();
    d.setHours(d.getHours() + hours);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Time Picker Popup for Reservations
window.showTimePickerPopup = async (spaceId, priceVal) => {
    // Fetch trusted time from API
    let currentTime;
    let usingFallback = false;

    try {
        const response = await fetch("https://worldtimeapi.org/api/timezone/America/Los_Angeles");
        if (!response.ok) throw new Error("API response not ok");
        const data = await response.json();
        currentTime = new Date(data.datetime);
        console.log("✓ Time synced from WorldTimeAPI:", currentTime);
    } catch (e) {
        console.warn("WorldTimeAPI failed, using local time:", e);
        currentTime = new Date();
        usingFallback = true;
    }

    // Calculate minimum time (2 hours from now)
    // Calculate minimum time (2 hours from now)
    const minTime = new Date(currentTime.getTime() + (2 * 60 * 60 * 1000));

    // Format minTime for datetime-local input (YYYY-MM-DDTHH:mm)
    // Adjust for timezone offset to ensure local time is correct in input
    const tzOffset = currentTime.getTimezoneOffset() * 60000;
    const minLocIso = new Date(minTime.getTime() - tzOffset).toISOString().slice(0, 16);
    const defaultsIso = new Date(minTime.getTime() - tzOffset).toISOString().slice(0, 16);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'time-picker-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
    `;

    const currentTimeDisplay = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const minTimeDisplay = minTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Dark mode colors - check body class directly for reliability
    const darkModeActive = document.body.classList.contains('dark-mode');
    console.log('Dark mode active:', darkModeActive);
    const popupBg = darkModeActive ? '#2c2c2c' : 'white';
    const popupText = darkModeActive ? '#e0e0e0' : '#333';
    const popupSubtext = darkModeActive ? '#aaa' : '#666';
    const inputBg = darkModeActive ? '#444' : 'white';
    const cancelBg = darkModeActive ? '#444' : '#f5f5f5';
    const cancelBorder = darkModeActive ? '#555' : '#ddd';

    overlay.innerHTML = `
        <div style="
            background: ${popupBg}; border-radius: 16px; padding: 24px; max-width: 340px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center;
        ">
            <div style="font-size: 40px; margin-bottom: 8px;">🕐</div>
            <h2 style="margin: 0 0 4px; color: ${popupText}; font-size: 20px;">Reserve Space ${spaceId}</h2>
            <p style="color: ${popupSubtext}; font-size: 13px; margin: 0 0 12px;">Rate: <b>$${priceVal.toFixed(2)}/hr</b></p>
            
            <div style="
                background: ${usingFallback ? '#fff3cd' : '#e8f5e9'}; 
                border: 1px solid ${usingFallback ? '#ffc107' : '#4caf50'};
                padding: 8px; border-radius: 8px; margin-bottom: 12px; font-size: 12px;
                color: ${usingFallback ? '#856404' : '#2e7d32'};
            ">
                ${usingFallback ? '⚠️ Using device time (API unavailable)' : '✓ Time verified via WorldTimeAPI'}<br>
                <b>Current Time:</b> ${currentTimeDisplay}
            </div>
            
            <div style="text-align: left; margin-bottom: 12px;">
                <label style="font-size: 13px; color: ${popupSubtext}; font-weight: bold;">Select Date & Time:</label>
                <input type="datetime-local" id="time-input" value="${defaultsIso}" min="${minLocIso}" style="
                    width: 100%; padding: 12px; margin-top: 6px;
                    border: 2px solid #1A73E8; border-radius: 8px;
                    font-size: 16px; cursor: pointer; font-family: sans-serif;
                    background: ${inputBg}; color: ${popupText};
                ">
                <div style="font-size: 11px; color: ${popupSubtext}; margin-top: 4px;">
                    ⏰ Earliest allowed: ${minTimeDisplay} (Today)
                </div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button id="time-cancel-btn" style="
                    flex: 1; padding: 12px; border: 1px solid ${cancelBorder}; background: ${cancelBg};
                    border-radius: 8px; font-size: 14px; cursor: pointer; color: ${popupText};
                ">Cancel</button>
                <button id="time-confirm-btn" style="
                    flex: 1; padding: 12px; border: none; background: #1A73E8;
                    color: white; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer;
                ">Confirm Reservation</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Button handlers
    document.getElementById('time-confirm-btn').onclick = async () => {
        const inputVal = document.getElementById('time-input').value;
        if (!inputVal) {
            alert("Please select a valid date and time.");
            return;
        }

        const selectedTime = new Date(inputVal);

        // Validation: Verify time is at least 2 hours in future (allow 1 min buffer for UI latency)
        // We use the same 'minTime' reference we calculated earlier
        if (selectedTime < minTime) {
            alert(`⚠️ Invalid Time.\n\nReservations must be at least 2 hours in advance.\nEarliest time: ${minTimeDisplay}`);
            return;
        }

        // PREMIUM CHECK for "Future" or "Available Soon" reservations
        // If user is NOT premium, block them here (Tease-then-Block pattern)
        // We know it's a future reservation because of the 2-hour minimum
        if (!isPremium) {
            overlay.remove();
            showPremiumRequiredPopup();
            return;
        }

        const hoursFromNow = (selectedTime - currentTime) / (1000 * 60 * 60);
        const reservationTime = selectedTime;

        overlay.remove();

        // Close info window
        if (activeInfoWindow) activeInfoWindow.close();

        // Find meter and create reservation
        const meter = parkingDatabase.find(m => m.spaceid === spaceId);
        if (!meter) return;

        const res = {
            spaceid: meter.spaceid,
            type: 'scheduled',
            lat: parseFloat(meter.latlng.latitude),
            lng: parseFloat(meter.latlng.longitude),
            price: meter.priceVal,
            startTime: reservationTime,
            hoursFromNow: hoursFromNow
        };

        myReservations.push(res);
        meter.status = 'taken';

        // Refresh Map
        updateMap(GlobalMarkerElement);

        const timeStr = reservationTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = reservationTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

        alert(`✅ Reservation Confirmed!\n\nSpace: ${spaceId}\nTime: ${timeStr} on ${dateStr}\nRate: $${meter.priceVal.toFixed(2)}/hr`);
    };

    document.getElementById('time-cancel-btn').onclick = () => {
        overlay.remove();
    };

    // Click outside to close
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
};

// Reservation Logic



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

    const MarkerDef = AdvancedMarkerElement || GlobalMarkerElement;
    renderMarkers(visibleMeters, MarkerDef);
    updateStats(visibleMeters, statsDiv);
}


// Settings & State
let useMetric = false;
let isDarkMode = false;
let directionsService, directionsRenderer;

// Initialize Routing
window.addEventListener('load', async () => {
    const { DirectionsService, DirectionsRenderer } = await google.maps.importLibrary("routes");
    directionsService = new DirectionsService();
    directionsRenderer = new DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: "#1A73E8", strokeWeight: 5 }
    });
    directionsRenderer.setMap(map);
});

// Toggle Functions
window.toggleSettings = () => {
    const panel = document.getElementById('settings-panel');
    panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
};

window.toggleTheme = () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);

    // Google Maps Dark Mode JSON
    const darkStyles = [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
        { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
        { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
        { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
        { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
        { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
        { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
    ];

    if (map) {
        map.setOptions({ styles: isDarkMode ? darkStyles : [] });
    }
};

window.toggleUnits = () => {
    useMetric = !useMetric;
    alert(`Units switched to ${useMetric ? "Metric" : "Imperial"}.`);
};

// SMART NAV & ROUTING
window.findSmartSpot = async (targetLoc, mode = 'cheapest') => {
    // If no specific target, use Persisted Search Pin OR Map Center
    if (!targetLoc) {
        targetLoc = window.searchDestination ? window.searchDestination : map.getCenter();
    }
    const { spherical } = await google.maps.importLibrary("geometry");

    // Filter for FREE spots
    const freeMeters = parkingDatabase.filter(m => m.status === 'free' && m.latlng);
    let bestSpot = null;
    let msg = "";

    // MODE: CLOSEST
    if (mode === 'closest') {
        let minDist = Infinity;
        freeMeters.forEach(meter => {
            const lat = parseFloat(meter.latlng.latitude);
            const lng = parseFloat(meter.latlng.longitude);
            const dist = spherical.computeDistanceBetween(targetLoc, new google.maps.LatLng(lat, lng));
            if (dist < minDist) { minDist = dist; bestSpot = meter; }
        });
        msg = "Found closest parking spot!";
    }
    // MODE: CHEAPEST (< 0.5mi / 0.8km)
    else {
        const radiusMeters = useMetric ? 800 : (0.5 * 1609.34);
        let candidates = [];
        freeMeters.forEach(meter => {
            const lat = parseFloat(meter.latlng.latitude);
            const lng = parseFloat(meter.latlng.longitude);
            const dist = spherical.computeDistanceBetween(targetLoc, new google.maps.LatLng(lat, lng));
            if (dist <= radiusMeters) candidates.push({ meter, dist });
        });

        if (candidates.length > 0) {
            candidates.sort((a, b) => { // Sort by Price, then Distance
                const pDiff = a.meter.priceVal - b.meter.priceVal;
                return pDiff !== 0 ? pDiff : a.dist - b.dist;
            });
            bestSpot = candidates[0].meter;
            msg = useMetric ? "Found cheapest spot within 800m!" : "Found cheapest spot within 0.5 miles!";
        } else {
            return window.findSmartSpot(targetLoc, 'closest'); // Fallback
        }
    }

    if (bestSpot) {
        const dest = { lat: parseFloat(bestSpot.latlng.latitude), lng: parseFloat(bestSpot.latlng.longitude) };
        alert(`${msg}\nPrice: $${bestSpot.priceVal}/hr\nDrawing route...`);
        map.panTo(dest);
        map.setZoom(18);

        // Draw Route
        if (directionsService) {
            directionsService.route({
                origin: targetLoc,
                destination: dest,
                travelMode: google.maps.TravelMode.DRIVING
            }, (res, status) => {
                if (status === "OK") directionsRenderer.setDirections(res);
                else console.warn("Route failed: " + status);
            });
        }
    } else {
        alert("No parking available at all.");
    }
};

window.navigateToCheapest = () => window.findSmartSpot(null, 'cheapest');
window.navigateToClosest = () => window.findSmartSpot(null, 'closest');

// Update Stats with New Buttons
function updateStats(meters, container) {
    if (meters.length === 0) {
        container.innerHTML = "No parking found.";
        return;
    }
    const available = meters.filter(m => m.status === 'free');
    let minPrice = Infinity;
    available.forEach(m => { if (m.priceVal > 0 && m.priceVal < minPrice) minPrice = m.priceVal; });
    const cheapDisp = minPrice !== Infinity ? `$${minPrice.toFixed(2)}` : "--";

    let reservationHtml = '';
    if (myReservations.length > 0) {
        let listHtml = myReservations.map((res, index) => `
            <div class="res-card">
                <div style="font-size:10px;"><b>Space ${res.spaceid}</b></div>
                <div style="display:flex; gap:4px; margin-top:4px;">
                    <button onclick="navigateToReservation(${index})" style="background:#1A73E8; color:white; border:none; border-radius:3px; padding:2px 6px; font-size:9px;">GO</button>
                    <button onclick="endReservation(${index})" style="background:#d93025; color:white; border:none; border-radius:3px; padding:2px 6px; font-size:9px;">END</button>
                </div>
            </div>`).join('');

        reservationHtml = `<details open class="res-details">
            <summary>My Reservations (${myReservations.length})</summary>
            <div style="padding:5px; max-height:150px; overflow-y:auto;">${listHtml}</div>
        </details>`;
    }

    // New Dual Buttons
    reservationHtml += `
        <div class="smart-find-box">
             <div class="sf-label">Smart Find</div>
             <div style="display:flex; gap:5px;">
                  <button onclick="navigateToClosest()" class="nav-btn-light">📍 Closest</button>
                  <button onclick="navigateToCheapest()" class="nav-btn-blue">💲 Cheapest</button>
             </div>
             <div class="sf-price">Best Price: <b>${cheapDisp}</b></div>
        </div>
    `;

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <div><small>VISIBLE</small> <b>${meters.length}</b></div>
            <div style="text-align:right;"><small>FREE</small> <b style="color:#34C759;">${available.length}</b></div>
        </div>
        ${reservationHtml}
    `;
}

function clearMarkers() {
    allMarkers.forEach(marker => marker.map = null);
    allMarkers = [];
}

function renderMarkers(data, AdvancedMarkerElement) {
    const MAX_RENDER = 1000;
    const renderData = data.slice(0, MAX_RENDER);
    const zoom = map.getZoom();

    const bigStarSvg = (color) => `
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" 
                   fill="${color}" stroke="white" stroke-width="1.5"/>
        </svg>
    `;

    renderData.forEach(meter => {
        const lat = parseFloat(meter.latlng.latitude);
        const lng = parseFloat(meter.latlng.longitude);

        let color = "#34C759";
        let zIndex = 3;

        let isMyReservation = myReservations.some(r => r.spaceid === meter.spaceid);

        if (meter.status === 'taken') {
            color = "#EA4335";
            zIndex = 1;
        } else if (meter.status === 'soon') {
            color = "#FBBC04";
            zIndex = 2;
        }

        if (isMyReservation) {
            color = "#1A73E8"; // Blue Star
            zIndex = 10;
        }

        let priceLabel = "";
        // SHOW PRICE ONLY IF ZOOM >= 18 (and not hidden by reservation/taken)
        const showPrice = (zoom >= PRICE_VISIBILITY_ZOOM);

        if (showPrice && meter.priceVal > 0 && meter.status !== 'taken' && !isMyReservation) {
            priceLabel = `<div class="price-tag" style="bottom: ${isMyReservation ? '40px' : '14px'};">$${meter.priceVal.toFixed(2)}</div>`;
        }

        const iconContainer = document.createElement('div');
        iconContainer.style.position = 'relative';

        if (isMyReservation) {
            iconContainer.innerHTML = `
                ${priceLabel}
                ${bigStarSvg(color)}
            `;
        } else {
            iconContainer.innerHTML = `
                ${priceLabel}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; margin:auto;">
                    <circle cx="8" cy="8" r="6" fill="${color}" stroke="white" stroke-width="2"/>
                </svg>
            `;
        }

        const marker = new AdvancedMarkerElement({
            map: map,
            position: { lat: lat, lng: lng },
            title: `ID: ${meter.spaceid}`,
            content: iconContainer,
            zIndex: zIndex
        });

        allMarkers.push(marker);

        if ((meter.status === 'free' || meter.status === 'soon') && !isMyReservation) {
            iconContainer.style.cursor = "pointer";

            marker.addListener('click', () => {
                const isSoon = (meter.status === 'soon');

                let buttonsHtml = '';

                if (isSoon) {
                    // Available Soon spots - Show Later button for EVERYONE (Tease feature), block in picker if not premium
                    buttonsHtml = `
                        <button onclick="showTimePickerPopup('${meter.spaceid}', ${meter.priceVal})" 
                            style="flex: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                            💎 Reserve Later
                        </button>
                    `;
                } else {
                    // Free spots - show time picker button (uses Time API)
                    buttonsHtml = `
                        <button onclick="showTimePickerPopup('${meter.spaceid}', ${meter.priceVal})" 
                            style="flex: 1; background: #1A73E8; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                            🕐 Reserve Spot
                        </button>
                    `;
                }

                const content = `
            <div style="padding: 10px; min-width: 200px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin: 0 0 5px 0; color: #333; font-size: 18px;">Space ${meter.spaceid}</h3>
                    <div style="cursor:pointer;" onclick="activeInfoWindow.close()">✕</div>
                </div>
                <p style="margin: 5px 0; color: #666; font-size: 14px;">
                    Status: <strong style="color: ${color};">${isSoon ? 'Available Soon (Premium)' : 'Free Now'}</strong><br>
                    Rate: $${meter.priceVal.toFixed(2)}/hr
                </p>

                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    ${buttonsHtml}
                </div>
                ${isSoon ? '<div style="margin-top:8px; font-size:10px; color:#7c4dff; text-align:center;">💎 Premium required to reserve</div>' : ''}
            </div>
        `;

                activeInfoWindow.setContent(content);
                activeInfoWindow.open(map, marker);
            });
        }
    });
}

window.upgradePremium = () => {
    if (isPremium) {
        // Show manage subscription options
        const action = confirm("💎 Premium Member\n\nYou're enjoying Premium benefits!\n\nClick OK to cancel subscription.");
        if (action) {
            isPremium = false;
            localStorage.setItem('loomis_premium', 'false');
            updatePremiumUI();
            alert("Subscription cancelled. You can re-subscribe anytime!");
        }
        return;
    }

    // Show pay popup
    showPayPopup();
};

function showPayPopup() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'pay-popup-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
    `;

    // Dark mode colors - check body class directly for reliability
    const darkModeActive = document.body.classList.contains('dark-mode');
    const popupBg = darkModeActive ? '#2c2c2c' : 'white';
    const popupText = darkModeActive ? '#e0e0e0' : '#333';
    const popupSubtext = darkModeActive ? '#aaa' : '#666';
    const cancelBg = darkModeActive ? '#444' : '#f5f5f5';
    const cancelBorder = darkModeActive ? '#555' : '#ddd';

    // Create popup
    overlay.innerHTML = `
        <div style="
            background: ${popupBg}; border-radius: 16px; padding: 24px; max-width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center;
        ">
            <div style="font-size: 48px; margin-bottom: 12px;">💎</div>
            <h2 style="margin: 0 0 8px; color: ${popupText}; font-size: 22px;">Upgrade to Premium</h2>
            <p style="color: ${popupSubtext}; font-size: 14px; margin: 0 0 16px;">
                Unlock future reservations and "Available Soon" spots!
            </p>
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; padding: 12px; border-radius: 8px; margin-bottom: 16px;
            ">
                <div style="font-size: 28px; font-weight: bold;">$5<span style="font-size: 14px;">/month</span></div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="pay-cancel-btn" style="
                    flex: 1; padding: 12px; border: 1px solid ${cancelBorder}; background: ${cancelBg};
                    border-radius: 8px; font-size: 14px; cursor: pointer; color: ${popupText};
                ">Cancel</button>
                <button id="pay-yes-btn" style="
                    flex: 1; padding: 12px; border: none; background: #34a853;
                    color: white; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer;
                ">Yes, Subscribe!</button>
            </div>
            <p style="color: ${popupSubtext}; font-size: 11px; margin: 12px 0 0;">(DEMO: Click Yes to activate)</p>
        </div>
    `;

    document.body.appendChild(overlay);

    // Button handlers
    document.getElementById('pay-yes-btn').onclick = () => {
        isPremium = true;
        localStorage.setItem('loomis_premium', 'true');
        updatePremiumUI();
        overlay.remove();
        showSuccessPopup();
    };

    document.getElementById('pay-cancel-btn').onclick = () => {
        overlay.remove();
    };

    // Click outside to close
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
}

function showSuccessPopup() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'success-popup-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
    `;

    // Dark mode colors - check body class directly for reliability
    const darkModeActive = document.body.classList.contains('dark-mode');
    const popupBg = darkModeActive ? '#2c2c2c' : 'white';
    const popupSubtext = darkModeActive ? '#aaa' : '#666';

    overlay.innerHTML = `
        <div style="
            background: ${popupBg}; border-radius: 16px; padding: 32px; max-width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center;
            animation: popIn 0.3s ease-out;
        ">
            <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
            <h2 style="margin: 0 0 8px; color: #34a853; font-size: 24px;">Welcome to Premium!</h2>
            <p style="color: ${popupSubtext}; font-size: 15px; margin: 0 0 24px; line-height: 1.5;">
                You've unlocked exclusive features:<br>
                <b>Future Reservations</b> & <b>Avail. Soon Booking</b>
            </p>
            <button id="success-close-btn" style="
                width: 100%; padding: 14px; border: none; background: #34a853;
                color: white; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;
                box-shadow: 0 4px 6px rgba(52, 168, 83, 0.3);
            ">Awesome!</button>
        </div>
        <style>
            @keyframes popIn {
                0% { transform: scale(0.8); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }
        </style>
    `;

    document.body.appendChild(overlay);

    document.getElementById('success-close-btn').onclick = () => {
        overlay.remove();
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
}

// Reservation Logic
window.handleReserve = async (spaceId, type) => {
    const meter = parkingDatabase.find(m => m.spaceid === spaceId);
    if (!meter) return;

    // ENFORCE PREMIUM for "Later" or "Soon" spots
    // If reserving "Now" on a "Free" spot -> Free for everyone (per previous understanding, but user said "future scheduling" needs premium)
    // User request: "change the premium so it does not allow you to reserve later or available soon without it"

    if ((type === 'later' || meter.status === 'soon') && !isPremium) {
        showPremiumRequiredPopup();
        return;
    }

    // Get time
    let startTime = new Date();
    try {
        if (typeof getTrustedTime === 'function') {
            const t = await getTrustedTime();
            if (t) startTime = t;
        }
    } catch (e) {
        console.warn("Time sync failed, using local", e);
    }

    const res = {
        spaceid: meter.spaceid,
        type: type,
        lat: parseFloat(meter.latlng.latitude),
        lng: parseFloat(meter.latlng.longitude),
        price: meter.priceVal,
        startTime: startTime
    };

    myReservations.push(res);
    meter.status = 'taken'; // Update local logic

    // Refresh Map
    updateMap(GlobalMarkerElement);

    // Close Window
    if (activeInfoWindow) activeInfoWindow.close();

    alert("Reservation Confirmed!\nSpace: " + spaceId);
};

function showPremiumRequiredPopup() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'premium-required-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
    `;

    // Dark mode colors - check body class directly for reliability
    const darkModeActive = document.body.classList.contains('dark-mode');
    const popupBg = darkModeActive ? '#2c2c2c' : 'white';
    const popupText = darkModeActive ? '#e0e0e0' : '#333';
    const popupSubtext = darkModeActive ? '#aaa' : '#666';
    const cancelBg = darkModeActive ? '#444' : '#f5f5f5';
    const cancelBorder = darkModeActive ? '#555' : '#ddd';

    overlay.innerHTML = `
        <div style="
            background: ${popupBg}; border-radius: 16px; padding: 24px; max-width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center;
        ">
            <div style="font-size: 48px; margin-bottom: 12px;">🔒</div>
            <h2 style="margin: 0 0 8px; color: ${popupText}; font-size: 20px;">Premium Feature</h2>
            <p style="color: ${popupSubtext}; font-size: 14px; margin: 0 0 16px; line-height: 1.5;">
                Reserving <b>"Available Soon"</b> spots and <b>future bookings</b> requires a Premium subscription.
            </p>
            <div style="
                background: #fff3cd; border: 1px solid #ffc107; padding: 10px;
                border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #856404;
            ">
                💡 Subscribe to Premium for just <b>$5/month</b>
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="prem-req-cancel" style="
                    flex: 1; padding: 12px; border: 1px solid ${cancelBorder}; background: ${cancelBg};
                    border-radius: 8px; font-size: 14px; cursor: pointer; color: ${popupText};
                ">Not Now</button>
                <button id="prem-req-subscribe" style="
                    flex: 1; padding: 12px; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer;
                ">Subscribe 💎</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('prem-req-subscribe').onclick = () => {
        overlay.remove();
        showPayPopup();
    };

    document.getElementById('prem-req-cancel').onclick = () => {
        overlay.remove();
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
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

// Easter Egg: Rain Animation
window.triggerRain = () => {
    const images = ['egg1.png', 'egg2.png', 'egg3.png'];
    // Prevent multiple containers
    if (document.getElementById('rain-container')) return;

    const container = document.createElement('div');
    container.id = 'rain-container';
    container.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10000; overflow:hidden;';
    document.body.appendChild(container);

    // Add styles for animation
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fall {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(110vh) rotate(360deg); opacity: 0.8; }
        }
    `;
    container.appendChild(style);

    // Spawn Drops
    for (let i = 0; i < 40; i++) {
        const img = document.createElement('img');
        img.src = images[Math.floor(Math.random() * images.length)];
        const size = 40 + Math.random() * 60; // 40-100px
        const dur = 2 + Math.random() * 3; // 2-5s

        img.style.cssText = `
            position: absolute;
            top: -150px;
            left: ${Math.random() * 100}vw;
            width: ${size}px;
            height: auto;
            animation: fall ${dur}s linear forwards;
            animation-delay: ${Math.random() * 4}s;
            opacity: 0.9;
        `;
        container.appendChild(img);
    }

    // Cleanup
    setTimeout(() => {
        container.remove();
    }, 10000);
};

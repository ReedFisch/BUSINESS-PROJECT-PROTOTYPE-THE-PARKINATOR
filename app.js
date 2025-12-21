/* The Parkinator - Real World Edition */
/* Strategy: Local DB + Pricing + Multi-Reservations + WorldTimeAPI + Mobile UX */

let map;
let allMarkers = [];
let parkingDatabase = [];
const ZOOM_THRESHOLD = 15;
const PRICE_VISIBILITY_ZOOM = 16; // Approx. 0.5 mile view on mobile
let activeInfoWindow = null;

// Track Multiple User Reservations
let myReservations = []; // { spaceid, type, lat, lng, time, price, startTime }

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
        gestureHandling: "greedy", // ENABLE ONE-FINGER PAN ON MOBILE
    });

    // SEARCH & PLACES SETUP
    const input = document.getElementById("pac-input");
    const { Autocomplete } = await google.maps.importLibrary("places");
    const autocomplete = new Autocomplete(input);
    autocomplete.bindTo("bounds", map);

    // Push input to top-left of map
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

    let destinationMarker = null;

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

        // Trigger Smart Nav to this location
        window.findSmartSpot(place.geometry.location);
    });

    activeInfoWindow = new InfoWindow();

    const statsDiv = document.getElementById('stats');
    statsDiv.textContent = "Loading local database...";

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
window.findSmartSpot = async (targetLoc) => {
    // If no specific target, use map center
    if (!targetLoc) {
        targetLoc = map.getCenter();
    }

    const { spherical } = await google.maps.importLibrary("geometry");

    // Filter for FREE spots only
    const freeMeters = parkingDatabase.filter(m => m.status === 'free' && m.latlng);

    // Helper to find best in radius
    const findBestInRadius = (radiusFactor) => {
        // radiusFactor is 0.5 or 1.0 (legacy values)
        // If metric, we treat 0.5 as 0.8km (~0.5mi) roughly kept same for logic simplicity
        // But strictly: 0.5 miles = 804 meters.

        let limitMeters = radiusFactor * 1609.34; // Default miles logic
        if (useMetric) {
            // If metric mode, let's just interpret the factor roughly:
            // 0.5 factor -> 800m
            // 1.0 factor -> 1600m
            limitMeters = (radiusFactor * 1600);
        }

        let bestSpot = null;
        let bestPrice = Infinity;

        freeMeters.forEach(meter => {
            const lat = parseFloat(meter.latlng.latitude);
            const lng = parseFloat(meter.latlng.longitude);
            const meterLoc = new google.maps.LatLng(lat, lng);

            const dist = spherical.computeDistanceBetween(targetLoc, meterLoc);

            if (dist <= radiusMeters) {
                if (meter.priceVal <= bestPrice) {
                    bestPrice = meter.priceVal;
                    bestSpot = meter; // Simple "Cheapest" wins. Could combine distance/price.
                }
            }
        });
        return bestSpot;
    };

    // 1. Try 0.5 Miles
    let spot = findBestInRadius(0.5);
    let msg = "Found cheapest spot within 0.5 miles!";

    // 2. Try 1.0 Miles
    if (!spot) {
        spot = findBestInRadius(1.0);
        msg = "No spots in 0.5mi. Found cheapest within 1 mile.";
    }

    // 3. Result
    if (spot) {
        alert(`${msg}\n\nPrice: $${spot.priceVal}/hr\nNavigating there now...`);
        const lat = parseFloat(spot.latlng.latitude);
        const lng = parseFloat(spot.latlng.longitude);
        map.panTo({ lat, lng });
        map.setZoom(19);
    } else {
        alert("Sorry! No parking available within 1 mile of this location.");
    }
};

let cheapestMeterInView = null; // Legacy but kept for "Visible" button

window.navigateToCheapest = () => {
    // Use Smart Nav based on CENTER
    window.findSmartSpot(null);
};

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
        const response = await fetch("http://worldtimeapi.org/api/timezone/America/Los_Angeles");
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

// Reservation Logic
window.handleReserve = async (spaceId, type) => {
    const meter = parkingDatabase.find(m => m.spaceid === spaceId);
    if (!meter) return;

    if (myReservations.some(r => r.spaceid === spaceId)) {
        alert("You have already reserved this space!");
        return;
    }

    let reserveTime = "Now";

    if (type === 'now') {
        alert(`SUCCESS!\n\nSpace ${spaceId} Reserved.\nRate: $${meter.priceVal}/hr`);
        meter.status = 'reserved';
    } else if (type === 'later') {
        let defaultTime = "6:00 PM";
        let promptMsg = "Enter reservation time:";

        if (meter.status === 'soon') {
            const minTimeStr = await getTimePlusHoursStr(2);
            defaultTime = minTimeStr;
            promptMsg = `Note: Spot uses Trusted API Time.\nEarliest Reservation: ${minTimeStr}\n\nEnter time:`;
        } else {
            const currentTimeStr = await getTimePlusHoursStr(0);
            defaultTime = currentTimeStr;
        }

        const time = prompt(promptMsg, defaultTime);
        if (time) {
            reserveTime = time;
            alert(`CONFIRMED.\n\nSpace ${spaceId} reserved for ${time}.`);
            meter.status = 'scheduled';
        } else {
            return;
        }
    }

    myReservations.push({
        spaceid: spaceId,
        type: type,
        time: reserveTime,
        price: meter.priceVal,
        lat: parseFloat(meter.latlng.latitude),
        lng: parseFloat(meter.latlng.longitude)
    });

    activeInfoWindow.close();

    google.maps.importLibrary("marker").then(({ AdvancedMarkerElement }) => {
        updateMap(AdvancedMarkerElement);
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

    let minPrice = Infinity;
    cheapestMeterInView = null;
    available.forEach(m => {
        if (m.priceVal > 0 && m.priceVal < minPrice) {
            minPrice = m.priceVal;
            cheapestMeterInView = m;
        }
    });
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
        const styles = isDarkMode ? [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
        ] : null;
        if (map) map.setOptions({ styles });
    };

    window.toggleUnits = () => {
        useMetric = !useMetric;
        alert(`Units switched to ${useMetric ? "Metric" : "Imperial"}.`);
    };

    // SMART NAV & ROUTING
    window.findSmartSpot = async (targetLoc, mode = 'cheapest') => {
        if (!targetLoc) targetLoc = map.getCenter();
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
            <div style="background:white; border-radius:6px; padding:6px; margin:4px 0; border-left:4px solid #1A73E8;">
                <div style="font-size:10px;"><b>Space ${res.spaceid}</b></div>
                <div style="display:flex; gap:4px; margin-top:4px;">
                    <button onclick="navigateToReservation(${index})" style="background:#1A73E8; color:white; border:none; border-radius:3px; padding:2px 6px; font-size:9px;">GO</button>
                    <button onclick="endReservation(${index})" style="background:#d93025; color:white; border:none; border-radius:3px; padding:2px 6px; font-size:9px;">END</button>
                </div>
            </div>`).join('');

            reservationHtml = `<details open style="background:#e8f0fe; border:1px solid #1A73E8; border-radius:8px; margin-bottom:8px;">
            <summary style="background:#d2e3fc; padding:5px; font-size:10px; font-weight:bold; color:#1967d2;">My Reservations (${myReservations.length})</summary>
            <div style="padding:5px; max-height:150px; overflow-y:auto;">${listHtml}</div>
        </details>`;
        }

        // New Dual Buttons
        reservationHtml += `
        <div style="background:#f1f3f4; padding:10px; border-radius:8px; text-align:center;">
             <div style="font-size:10px; color:#555; text-transform:uppercase; margin-bottom:5px;">Smart Find</div>
             <div style="display:flex; gap:5px;">
                  <button onclick="navigateToClosest()" style="flex:1; background:white; border:1px solid #dadce0; color:#3c4043; padding:8px 4px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:11px;">📍 Closest</button>
                  <button onclick="navigateToCheapest()" style="flex:1; background:#1967d2; border:none; color:white; padding:8px 4px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:11px;">💲 Cheapest</button>
             </div>
             <div style="margin-top:4px; font-size:10px; color:#188038;">Best Price: <b>${cheapDisp}</b></div>
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
                priceLabel = `<div style="
                background: white; padding: 1px 4px; border-radius: 4px; font-size: 10px; font-weight: bold; color: #333; 
                box-shadow: 0 1px 2px rgba(0,0,0,0.2); margin-bottom: 2px; white-space: nowrap; position: absolute; bottom: ${isMyReservation ? '40px' : '14px'}; left: 50%; transform: translateX(-50%);
            ">$${meter.priceVal.toFixed(2)}</div>`;
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

            if ((meter.status === 'free' || meter.status === 'soon') && !isMyReservation) {
                iconContainer.style.cursor = "pointer";

                marker.addListener('click', () => {
                    const isSoon = (meter.status === 'soon');
                    let nowBtn = '';

                    if (isSoon) {
                        nowBtn = `<button disabled style="
                        background:#ccc; color:#666; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; flex:1; cursor:not-allowed;
                     ">Occupied</button>`;
                    } else {
                        nowBtn = `<button onclick="window.handleReserve('${meter.spaceid}', 'now')" style="
                        background:#1A73E8; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold; flex:1;
                     ">Reserve Now</button>`;
                    }

                    const contentStr = `
                    <div style="font-family:Roboto,sans-serif; min-width:200px;">
                        <h3 style="margin:0 0 8px 0; font-size:16px;">Space ${meter.spaceid}</h3>
                        <p style="margin:0 0 8px 0; color:#555;">
                            Status: <b style="color:${isSoon ? '#F9A825' : '#188038'}">${isSoon ? 'Available Soon' : 'Free Now'}</b><br>
                            Rate: <b>$${meter.priceVal || 'N/A'}</b>
                        </p>
                        <div style="display:flex; gap:8px;">
                            ${nowBtn}
                            <button onclick="window.handleReserve('${meter.spaceid}', 'later')" style="
                                background:#f1f3f4; color:#3c4043; border:1px solid #dadce0; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold; flex:1;
                            ">Later</button>
                        </div>
                        ${isSoon ? `<div style='font-size:10px; color:#555; margin-top:8px;'>*Verifying time via API...</div>` : ''}
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

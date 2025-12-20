/* The Parkinator - Real World Edition */
/* Strategy: Local DB + Pricing + Multi-Reservations + WorldTimeAPI */

let map;
let allMarkers = [];
let parkingDatabase = [];
const ZOOM_THRESHOLD = 15;
let activeInfoWindow = null;

// Track Multiple User Reservations
let myReservations = [];

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

window.navigateToReservation = (index) => {
    if (myReservations[index]) {
        const res = myReservations[index];
        map.panTo({ lat: res.lat, lng: res.lng });
        map.setZoom(19);
    }
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

// Helper: Get Time Object + Hours
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
        alert(`SUCCESS!\n\nSpace ${spaceId} Reserved for 15 minutes.\n$${meter.priceVal} charged.`);
        meter.status = 'reserved';
    } else if (type === 'later') {

        // Use Trusted API Time
        let defaultTime = "6:00 PM"; // fallback
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
    const cheapDisp = minPrice !== Infinity ? `$${minPrice.toFixed(2)}` : "--";

    // Dynamic Dropdown for Reservations
    let reservationHtml = '';

    if (myReservations.length > 0) {
        let listHtml = myReservations.map((res, index) => {
            return `
                <div style="
                    background:white; border-radius:6px; padding:6px; margin:4px 0; 
                    display:flex; justify-content:space-between; align-items:center; border-left: 4px solid #F57F17;
                ">
                    <div style="font-size:11px; text-align:left;">
                        <b>ID: ${res.spaceid}</b><br>
                        Time: ${res.time}
                    </div>
                    <button onclick="navigateToReservation(${index})" style="
                        background:#F57F17; color:white; border:none; border-radius:100px; padding:4px 8px; font-size:10px; cursor:pointer;
                    ">GO</button>
                </div>
            `;
        }).join('');

        // Use DETAILS element for Dropdown
        reservationHtml = `
            <div style="margin-bottom:8px;">
                 <details open style="
                    background:#FFF8E1; border: 1px solid #FFD54F; border-radius:8px; overflow:hidden;
                 ">
                    <summary style="
                        background:#FFECB3; padding:8px; font-size:11px; text-transform:uppercase; color:#F57F17; font-weight:bold; cursor:pointer; outline:none;
                    ">
                        My Reservations (${myReservations.length}) ▼
                    </summary>
                    <div style="padding:4px; max-height:150px; overflow-y:auto;">
                        ${listHtml}
                    </div>
                 </details>
            </div>
            
             <a href="#" onclick="navigateToCheapest()" style="color:#1967d2; font-size:11px; display:block; text-align:center; margin-top:4px;">
                Find Cheap Spot ($${minPrice.toFixed(2)})
             </a>
        `;
    } else {
        reservationHtml = `
            <div style="background:#e8f0fe; padding:10px; border-radius:8px; text-align:center;">
                 <div style="font-size:10px; text-transform:uppercase; color:#1967d2;">Cheapest Nearby</div>
                 <div style="font-size:24px; font-weight:900; color:#1967d2;">${cheapDisp}</div>
                 <button onclick="navigateToCheapest()" style="
                    background: #1967d2; border:none; color:white; padding:6px 12px; border-radius:100px; cursor:pointer; font-weight:bold;
                 ">Navigate to Meter</button>
            </div>
        `;
    }

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
            color = "#FBC02D";
            zIndex = 10;
        }

        let priceLabel = "";
        if (meter.priceVal > 0 && meter.status !== 'taken' && !isMyReservation) {
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

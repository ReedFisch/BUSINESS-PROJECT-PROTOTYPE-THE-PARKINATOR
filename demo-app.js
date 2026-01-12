/* Demo Parking Lot - Realistic Visual Design */

console.log("Demo Parking Lot (Realistic) starting...");

// State
window.isPremium = localStorage.getItem('loomis_premium') === 'true';

// Parking Data - 5 rows x 6 spots = 30 spots
const parkingSpots = [];
const priceTiers = [1.50, 2.00, 2.50, 3.00, 3.50, 4.00];
const statuses = ['free', 'free', 'free', 'free', 'free', 'taken', 'taken', 'soon'];

for (let i = 1; i <= 30; i++) {
    parkingSpots.push({
        id: `${String(i).padStart(2, '0')}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        price: priceTiers[Math.floor(Math.random() * priceTiers.length)]
    });
}

// User reservations
let myReservations = [];

// ==================== INITIALIZATION ====================
window.addEventListener('DOMContentLoaded', () => {
    renderParkingLot();
    updateStats();
    updatePremiumUI();

    if (localStorage.getItem('loomis_dark') === 'true') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }
});

function renderParkingLot() {
    const grid = document.getElementById('parking-grid');
    grid.innerHTML = '';

    const rows = ['A', 'B', 'C', 'D', 'E'];
    const spotsPerRow = 6;

    rows.forEach((rowLetter, rowIndex) => {
        // Create parking row
        const rowEl = document.createElement('div');
        rowEl.className = 'parking-row';
        rowEl.innerHTML = `<div class="row-label">${rowLetter}</div>`;

        // Add spots to row
        for (let col = 0; col < spotsPerRow; col++) {
            const spotIndex = rowIndex * spotsPerRow + col;
            const spot = parkingSpots[spotIndex];

            const spotEl = document.createElement('div');
            const isReserved = myReservations.some(r => r.id === spot.id);

            spotEl.className = `parking-spot ${isReserved ? 'reserved' : spot.status}`;
            spotEl.id = `spot-${spot.id}`;

            if (spot.status === 'taken' && !isReserved) {
                spotEl.innerHTML = `
                    <span class="car-icon">🚗</span>
                `;
            } else {
                spotEl.innerHTML = `
                    <span class="spot-id">${rowLetter}${col + 1}</span>
                    ${spot.status !== 'taken' ? `<span class="spot-price">$${spot.price.toFixed(2)}/hr</span>` : ''}
                `;
            }

            if (spot.status !== 'taken' && !isReserved) {
                spotEl.onclick = () => showSpotPopup(spot, `${rowLetter}${col + 1}`);
            }

            rowEl.appendChild(spotEl);
        }

        grid.appendChild(rowEl);

        // Add driving lane after rows B and D
        if (rowLetter === 'B' || rowLetter === 'D') {
            const lane = document.createElement('div');
            lane.className = 'driving-lane';
            lane.innerHTML = `
                <div class="lane-marking"></div>
                <span class="lane-arrow">→ → → →</span>
            `;
            grid.appendChild(lane);
        }
    });
}

// ==================== STATS PANEL ====================
function updateStats() {
    const statsEl = document.getElementById('stats');
    const available = parkingSpots.filter(s => s.status === 'free').length;
    const total = parkingSpots.length;
    const taken = parkingSpots.filter(s => s.status === 'taken').length;

    let minPrice = Infinity;
    parkingSpots.filter(s => s.status === 'free').forEach(s => {
        if (s.price < minPrice) minPrice = s.price;
    });
    const cheapDisp = minPrice !== Infinity ? `$${minPrice.toFixed(2)}` : "--";

    let reservationHtml = '';
    if (myReservations.length > 0) {
        let listHtml = myReservations.map((res, idx) => `
            <div class="res-card">
                <div style="font-size:10px;"><b>Space ${res.displayId}</b> - $${res.price.toFixed(2)}/hr</div>
                <button onclick="endReservation(${idx})" style="margin-top:4px; background:#d93025; color:white; border:none; border-radius:3px; padding:2px 6px; font-size:9px; cursor:pointer;">END</button>
            </div>
        `).join('');

        reservationHtml = `
            <details open class="res-details">
                <summary>My Reservations (${myReservations.length})</summary>
                <div style="padding:5px; max-height:100px; overflow-y:auto;">${listHtml}</div>
            </details>
        `;
    }

    statsEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <div><small>TOTAL</small> <b>${total}</b></div>
            <div><small>TAKEN</small> <b style="color:#e53935;">${taken}</b></div>
            <div style="text-align:right;"><small>AVAILABLE</small> <b style="color:#34C759;">${available}</b></div>
        </div>
        ${reservationHtml}
        <div class="smart-find-box">
            <div class="sf-label" style="font-size: 11px; font-weight: 600; margin-bottom: 8px;">✨ SMART FIND</div>
            <div style="display:flex; gap:8px; margin-bottom: 10px;">
                <button onclick="findClosest()" class="nav-btn-light">📍 Closest</button>
                <button onclick="findCheapest()" class="nav-btn-blue">💲 Cheapest</button>
            </div>
            <div class="sf-price" style="font-size: 13px; padding: 6px 10px; background: rgba(24, 128, 56, 0.1); border-radius: 6px; display: inline-block;">Best Price: <b style="font-size: 15px;">${cheapDisp}</b></div>
        </div>
    `;
}

// ==================== SMART FIND ====================
window.findCheapest = () => {
    const freeSpots = parkingSpots.filter(s => s.status === 'free' && !myReservations.some(r => r.id === s.id));
    if (freeSpots.length === 0) {
        alert("No available spots!");
        return;
    }

    freeSpots.sort((a, b) => a.price - b.price);
    const cheapest = freeSpots[0];
    const spotIndex = parkingSpots.indexOf(cheapest);
    const row = ['A', 'B', 'C', 'D', 'E'][Math.floor(spotIndex / 6)];
    const col = (spotIndex % 6) + 1;

    highlightSpot(cheapest.id);
    alert(`💲 Cheapest Spot Found!\n\nSpot: ${row}${col}\nPrice: $${cheapest.price.toFixed(2)}/hr`);
};

window.findClosest = () => {
    const freeSpots = parkingSpots.filter(s => s.status === 'free' && !myReservations.some(r => r.id === s.id));
    if (freeSpots.length === 0) {
        alert("No available spots!");
        return;
    }

    // "Closest to entrance" = first row (A)
    const closest = freeSpots[0];
    const spotIndex = parkingSpots.indexOf(closest);
    const row = ['A', 'B', 'C', 'D', 'E'][Math.floor(spotIndex / 6)];
    const col = (spotIndex % 6) + 1;

    highlightSpot(closest.id);
    alert(`📍 Closest Spot to Entrance!\n\nSpot: ${row}${col}\nPrice: $${closest.price.toFixed(2)}/hr`);
};

function highlightSpot(spotId) {
    document.querySelectorAll('.parking-spot').forEach(el => {
        el.style.outline = '';
        el.style.animation = '';
    });

    const spotEl = document.getElementById(`spot-${spotId}`);
    if (spotEl) {
        spotEl.style.outline = '4px solid #FFD700';
        spotEl.style.animation = 'pulse 1s ease-in-out 3';
        spotEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Add pulse animation
const style = document.createElement('style');
style.innerHTML = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }
`;
document.head.appendChild(style);

// ==================== SPOT POPUP ====================
function showSpotPopup(spot, displayId) {
    const isSoon = spot.status === 'soon';
    const darkMode = document.body.classList.contains('dark-mode');

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="popup-card" style="text-align:left;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; font-size:22px;">🅿️ Spot ${displayId}</h3>
                <button onclick="this.closest('.popup-overlay').remove()" style="background:${darkMode ? '#444' : '#f5f5f5'}; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:14px;">✕</button>
            </div>
            
            <div style="background:${darkMode ? '#3a3a3a' : '#f8f9fa'}; padding:14px; border-radius:10px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:${darkMode ? '#aaa' : '#666'};">Status</span>
                    <strong style="color:${isSoon ? '#FFC107' : '#4CAF50'};">${isSoon ? '⏳ Available Soon' : '✓ Available Now'}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:${darkMode ? '#aaa' : '#666'};">Rate</span>
                    <strong style="font-size:16px;">$${spot.price.toFixed(2)}/hr</strong>
                </div>
            </div>
            
            ${isSoon ? `
                <button onclick="reservePremium('${spot.id}', '${displayId}')" style="width:100%; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; border:none; padding:14px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; margin-bottom:10px;">
                    💎 Reserve for Later
                </button>
                <div style="padding:10px; background:linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%); border-radius:8px; font-size:12px; color:#667eea; text-align:center;">
                    💎 Premium required to reserve
                </div>
            ` : `
                <button onclick="reserveNow('${spot.id}', '${displayId}')" style="width:100%; background:linear-gradient(135deg, #4CAF50 0%, #388E3C 100%); color:white; border:none; padding:14px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; margin-bottom:10px;">
                    ✓ Reserve Now
                </button>
                <div style="display:flex; gap:8px; margin-bottom:10px;">
                    <button onclick="reservePremium('${spot.id}', '${displayId}')" style="flex:1; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px;">
                        💎 Hold 10 Min
                    </button>
                    <button onclick="reservePremium('${spot.id}', '${displayId}')" style="flex:1; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px;">
                        💎 Reserve Later
                    </button>
                </div>
                <div style="padding:10px; background:linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%); border-radius:8px; font-size:12px; color:#667eea; text-align:center;">
                    💎 Hold & Reserve Later require Premium
                </div>
            `}
        </div>
    `;

    document.body.appendChild(overlay);
}

// ==================== RESERVATIONS ====================
window.reserveNow = (spotId, displayId) => {
    const spot = parkingSpots.find(s => s.id === spotId);
    if (!spot) return;

    spot.status = 'taken';
    myReservations.push({ id: spot.id, displayId, price: spot.price, time: new Date() });

    document.querySelector('.popup-overlay')?.remove();
    renderParkingLot();
    updateStats();

    alert(`✅ Reservation Confirmed!\n\nSpot: ${displayId}\nRate: $${spot.price.toFixed(2)}/hr\n\n🚗 Your spot is reserved!`);
};

window.reservePremium = (spotId, displayId) => {
    if (!window.isPremium) {
        showPremiumRequiredPopup();
        return;
    }

    const spot = parkingSpots.find(s => s.id === spotId);
    if (!spot) return;

    spot.status = 'taken';
    myReservations.push({ id: spot.id, displayId, price: spot.price, time: new Date() });

    document.querySelector('.popup-overlay')?.remove();
    renderParkingLot();
    updateStats();

    alert(`✅ Premium Reservation Confirmed!\n\nSpot: ${displayId}\nRate: $${spot.price.toFixed(2)}/hr`);
};

window.endReservation = (idx) => {
    if (idx < 0 || idx >= myReservations.length) return;

    const res = myReservations[idx];
    const spot = parkingSpots.find(s => s.id === res.id);
    if (spot) spot.status = 'free';

    myReservations.splice(idx, 1);
    renderParkingLot();
    updateStats();

    alert(`Reservation ended for spot ${res.displayId}`);
};

// ==================== PREMIUM ====================
function updatePremiumUI() {
    const statusEl = document.getElementById('premium-status');
    const btnEl = document.getElementById('premium-btn');

    if (statusEl) {
        statusEl.innerHTML = window.isPremium
            ? 'Status: <b style="color:#4CAF50;">Premium 💎</b>'
            : 'Status: <b>Free</b>';
    }
    if (btnEl) {
        btnEl.innerText = window.isPremium ? '✓ Premium Active' : '💎 Upgrade ($9.99)';
        btnEl.style.background = window.isPremium ? '#4CAF50' : '#fbbc04';
        btnEl.style.color = window.isPremium ? 'white' : '#333';
    }
}

window.upgradePremium = () => {
    if (window.isPremium) {
        if (confirm("Cancel your Premium subscription?")) {
            window.isPremium = false;
            localStorage.setItem('loomis_premium', 'false');
            updatePremiumUI();
            alert("Subscription cancelled.");
        }
        return;
    }
    showPayPopup();
};

function showPayPopup() {
    const darkMode = document.body.classList.contains('dark-mode');
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="popup-card">
            <div style="font-size:48px; margin-bottom:12px;">💎</div>
            <h2 style="margin:0 0 8px; font-size:22px;">Upgrade to Premium</h2>
            <p style="color:${darkMode ? '#aaa' : '#666'}; font-size:14px; margin:0 0 16px;">Unlock future reservations and "Available Soon" spots!</p>
            <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:16px; border-radius:10px; margin-bottom:16px;">
                <div style="font-size:32px; font-weight:bold;">$9.99<span style="font-size:14px;">/month</span></div>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="this.closest('.popup-overlay').remove()" style="flex:1; padding:14px; border:1px solid ${darkMode ? '#555' : '#ddd'}; background:${darkMode ? '#444' : '#f5f5f5'}; border-radius:8px; cursor:pointer; color:${darkMode ? '#fff' : '#333'};">Cancel</button>
                <button onclick="activatePremium()" style="flex:1; padding:14px; border:none; background:#4CAF50; color:white; border-radius:8px; font-weight:bold; cursor:pointer;">Subscribe!</button>
            </div>
            <p style="color:${darkMode ? '#888' : '#999'}; font-size:11px; margin:12px 0 0;">(DEMO: Click Subscribe to activate)</p>
        </div>
    `;

    document.body.appendChild(overlay);
}

window.activatePremium = () => {
    window.isPremium = true;
    localStorage.setItem('loomis_premium', 'true');
    updatePremiumUI();
    document.querySelector('.popup-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="popup-card">
            <div style="font-size:64px; margin-bottom:16px;">🎉</div>
            <h2 style="margin:0 0 8px; color:#4CAF50; font-size:26px;">Welcome to Premium!</h2>
            <p style="color:#666; font-size:15px; margin:0 0 24px;">You've unlocked all premium features!</p>
            <button onclick="this.closest('.popup-overlay').remove()" style="width:100%; padding:16px; border:none; background:#4CAF50; color:white; border-radius:8px; font-size:16px; font-weight:bold; cursor:pointer;">Awesome!</button>
        </div>
    `;

    document.body.appendChild(overlay);
};

function showPremiumRequiredPopup() {
    document.querySelector('.popup-overlay')?.remove();
    const darkMode = document.body.classList.contains('dark-mode');

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="popup-card">
            <div style="font-size:48px; margin-bottom:12px;">🔒</div>
            <h2 style="margin:0 0 8px; font-size:20px;">Premium Feature</h2>
            <p style="color:${darkMode ? '#aaa' : '#666'}; font-size:14px; margin:0 0 16px; line-height:1.5;">
                Reserving <b>"Available Soon"</b> spots and <b>future bookings</b> requires Premium.
            </p>
            <div style="background:#fff3cd; border:1px solid #ffc107; padding:12px; border-radius:8px; margin-bottom:16px; font-size:13px; color:#856404;">
                💡 Subscribe for just <b>$9.99/month</b>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="this.closest('.popup-overlay').remove()" style="flex:1; padding:12px; border:1px solid ${darkMode ? '#555' : '#ddd'}; background:${darkMode ? '#444' : '#f5f5f5'}; border-radius:8px; cursor:pointer; color:${darkMode ? '#fff' : '#333'};">Not Now</button>
                <button onclick="this.closest('.popup-overlay').remove(); showPayPopup();" style="flex:1; padding:12px; border:none; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; border-radius:8px; font-weight:bold; cursor:pointer;">Subscribe 💎</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
}

// ==================== SETTINGS ====================
window.toggleSettings = () => {
    const panel = document.getElementById('settings-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
};

window.toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('loomis_dark', document.body.classList.contains('dark-mode'));
};

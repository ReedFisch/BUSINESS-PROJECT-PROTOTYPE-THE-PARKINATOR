import cv2
import numpy as np
import json

def extract_spots(image_path):
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not read {image_path}")
        return

    # Convert to HSV
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # --- CYAN DOTS (Regular) ---
    # Widen range to catch light blue / cyan / aqua
    # Hue 70-130 covers green-blue to purple-blue
    lower_cyan = np.array([70, 100, 100]) # Lower saturation/value to catch lighter dots
    upper_cyan = np.array([130, 255, 255])
    mask_cyan = cv2.inRange(hsv, lower_cyan, upper_cyan)

    # --- PINK DOTS (Disability) ---
    # Pink is around Hue 300-330 (OpenCV: ~150-165)
    lower_pink = np.array([145, 100, 150])
    upper_pink = np.array([170, 255, 255])
    mask_pink = cv2.inRange(hsv, lower_pink, upper_pink)

    def find_centers(mask, label_type):
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        centers = []
        height, width = img.shape[:2]
        
        for cnt in contours:
            M = cv2.moments(cnt)
            if M["m00"] != 0:
                cX = int(M["m10"] / M["m00"])
                cY = int(M["m01"] / M["m00"])
                
                # Convert to percentage
                pct_x = round((cX / width) * 100, 2)
                pct_y = round((cY / height) * 100, 2)
                
                centers.append({
                    "left": pct_x,
                    "top": pct_y,
                    "type": label_type
                })
        return centers

    cyan_spots = find_centers(mask_cyan, "regular")
    pink_spots = find_centers(mask_pink, "disability")
    
    all_spots = cyan_spots + pink_spots
    
    # Sort spots: primarily by Row (Y), then by Column (X)
    # We group by Y bands (approx 5% height) to form rows
    all_spots.sort(key=lambda s: (round(s['top'] / 5), s['left']))
    
    # Assign IDs
    row_letters = "ABCDEFGH"
    current_row_idx = -1
    last_y_band = -1
    spot_num = 1
    
    final_spots = []
    
    # Re-sort strict for ID assignment
    for i, spot in enumerate(all_spots):
        y_band = round(spot['top'] / 5)
        if y_band != last_y_band:
            current_row_idx += 1
            last_y_band = y_band
            spot_num = 1
        
        row_char = row_letters[current_row_idx % len(row_letters)]
        spot_id = f"{row_char}{spot_num}"
        spot_num += 1
        
        spot['id'] = spot_id
        final_spots.append(spot)

    print(f"Found {len(cyan_spots)} regular spots (Cyan)")
    print(f"Found {len(pink_spots)} disability spots (Pink)")
    
    # Generate JS content
    js_content = generate_js(final_spots)
    
    with open("demo-app.js", "w") as f:
        f.write(js_content)
    
    print("generated demo-app.js")

def generate_js(spots):
    spot_defs = ",\n".join([
        f"    {{ id: '{s['id']}', left: {s['left']}, top: {s['top']}, type: '{s['type']}' }}" 
        for s in spots
    ])
    
    return f'''/* Generated from user labeled image */
console.log("Parking Demo (User Labeled) loading...");

window.isPremium = localStorage.getItem('loomis_premium') === 'true';

const spotDefinitions = [
{spot_defs}
];

const priceTiers = [1.50, 2.00, 2.50, 3.00];
const statusOptions = ['free', 'free', 'free', 'free', 'taken', 'taken', 'soon'];

const allSpots = spotDefinitions.map(def => ({{
    ...def,
    status: statusOptions[Math.floor(Math.random() * statusOptions.length)],
    price: priceTiers[Math.floor(Math.random() * priceTiers.length)]
}}));

let myReservations = [];

window.addEventListener('DOMContentLoaded', () => {{
    renderSpots();
    updateStats();
    updatePremiumUI();
    if (localStorage.getItem('loomis_dark') === 'true') {{
        document.body.classList.add('dark-mode');
        const t = document.getElementById('dark-mode-toggle');
        if (t) t.checked = true;
    }}
}});

function renderSpots() {{
    const container = document.getElementById('spots-container');
    container.innerHTML = '';
    allSpots.forEach(spot => {{
        const isRes = myReservations.some(r => r.id === spot.id);
        const el = document.createElement('div');
        el.className = `spot ${{isRes ? 'reserved' : spot.status}} ${{spot.type === 'disability' ? 'disability-spot' : ''}}`;
        el.id = `spot-${{spot.id}}`;
        el.style.left = spot.left + '%';
        el.style.top = spot.top + '%';
        
        // Tooltip
        let title = `${{spot.id}}`;
        if (spot.type === 'disability') title += " (♿ Reserved)";
        else title += ` - $${{spot.price.toFixed(2)}}/hr`;
        el.title = title;
        
        // Add wheelchair icon for disability spots
        if (spot.type === 'disability') {{
            el.innerHTML = '<span style="font-size:8px; display:block; text-align:center; line-height:10px;">♿</span>';
            el.style.backgroundColor = '#E91E63'; // Pinkish for visibility
            el.style.border = '1px solid white';
        }}

        if (spot.status !== 'taken' && !isRes) {{
            el.onclick = () => showSpotPopup(spot);
        }}
        container.appendChild(el);
    }});
}}

function updateStats() {{
    const el = document.getElementById('stats');
    // Filter out disability spots for "Find" logic stats? Or keep them?
    // User said: "don't detect in the find parking"
    // So "FREE" count should probably exclude them, or just count them separately.
    
    let total = 0, free = 0, taken = 0, minP = Infinity;
    
    allSpots.forEach(s => {{
        if (s.type === 'disability') return; // Exclude from stats/finding
        
        total++;
        if (s.status === 'free') {{ 
            free++; 
            if (s.price < minP) minP = s.price; 
        }} else if (s.status === 'taken') {{
            taken++;
        }}
    }});
    
    let resHtml = myReservations.length ? `<details open class="res-details"><summary>Reserved (${{myReservations.length}})</summary><div style="padding:3px;">${{myReservations.map((r,i) => `<div class="res-card"><b>${{r.id}}</b> <button onclick="endReservation(${{i}})" style="background:#d93025;color:white;border:none;border-radius:2px;padding:1px 4px;font-size:8px;cursor:pointer;">END</button></div>`).join('')}}</div></details>` : '';
    
    el.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:10px;">
            <div><small>REGULAR</small> <b>${{total}}</b></div>
            <div><small>TAKEN</small> <b style="color:#e53935;">${{taken}}</b></div>
            <div><small>FREE</small> <b style="color:#4CAF50;">${{free}}</b></div>
        </div>
        ${{resHtml}}
        <div class="smart-find-box">
            <div class="sf-label" style="font-size:9px;font-weight:600;margin-bottom:4px;">✨ SMART FIND</div>
            <div style="display:flex;gap:4px;margin-bottom:5px;">
                <button onclick="findClosest()" class="nav-btn-light" style="font-size:9px;padding:4px;">📍 Closest</button>
                <button onclick="findCheapest()" class="nav-btn-blue" style="font-size:9px;padding:4px;">💲 Cheapest</button>
            </div>
            <div style="font-size:10px;background:rgba(76,175,80,0.1);padding:3px 5px;border-radius:3px;">Best: <b>${{minP !== Infinity ? '$' + minP.toFixed(2) : '--'}}</b></div>
        </div>
    `;
}}

window.findCheapest = () => {{
    let best = null;
    allSpots.forEach(s => {{
        if (s.type === 'disability') return; // Exclude disability
        if (s.status === 'free' && !myReservations.some(r => r.id === s.id)) {{
            if (!best || s.price < best.price) best = s;
        }}
    }});
    if (best) {{ highlight(best.id); alert(`💲 Cheapest: ${{best.id}}\\n$${{best.price.toFixed(2)}}/hr`); }}
    else alert("No regular spots available!");
}};

window.findClosest = () => {{
    // Simple logic: first available spot in the list (usually top-left)
    const first = allSpots.find(s => s.type !== 'disability' && s.status === 'free' && !myReservations.some(r => r.id === s.id));
    if (first) {{ highlight(first.id); alert(`📍 Closest: ${{first.id}}\\n$${{first.price.toFixed(2)}}/hr`); }}
    else alert("No regular spots available!");
}};

function highlight(id) {{
    document.querySelectorAll('.spot').forEach(e => e.style.outline = '');
    const el = document.getElementById(`spot-${{id}}`);
    if (el) {{ el.style.outline = '3px solid #FFD700'; el.scrollIntoView({{ behavior: 'smooth', block: 'center' }}); }}
}}

function showSpotPopup(spot) {{
    const dark = document.body.classList.contains('dark-mode');
    const isDisability = spot.type === 'disability';
    
    // Popup content
    let statusText = spot.status === 'soon' ? '⏳ Soon' : '✓ Free';
    if (isDisability) statusText = '♿ Reserved';
    
    const o = document.createElement('div');
    o.className = 'popup-overlay';
    o.onclick = e => {{ if (e.target === o) o.remove(); }};
    o.innerHTML = `
        <div class="popup-card" style="text-align:left;">
            <h3>🅿️ Spot ${{spot.id}} ${{isDisability ? '♿' : ''}}</h3>
            <p>Type: <b>${{isDisability ? 'Disability Permit Only' : 'Regular'}}</b></p>
            ${{!isDisability ? `<p>Rate: <b>$${{spot.price.toFixed(2)}}/hr</b></p>` : ''}}
            <button onclick="reserveNow('${{spot.id}}')" style="width:100%;background:${{isDisability?'#E91E63':'#4CAF50'}};color:white;border:none;padding:10px;border-radius:6px;font-weight:bold;cursor:pointer;">
                ${{isDisability ? 'Verify Permit & Reserve' : '✓ Reserve Now'}}
            </button>
        </div>
    `;
    document.body.appendChild(o);
}}

window.reserveNow = id => {{
    const s = allSpots.find(x => x.id === id);
    if (!s) return;
    
    if (s.type === 'disability') {{
        if (!confirm("⚠️ This requires a valid Disability Parking Permit.\\n\\nDo you have a permit displayed?")) return;
    }}
    
    s.status = 'taken';
    myReservations.push({{ id: s.id, price: s.price }});
    document.querySelector('.popup-overlay')?.remove();
    renderSpots(); updateStats();
    alert(`✅ Reserved: ${{id}}`);
}};

window.endReservation = i => {{
    const r = myReservations[i];
    const s = allSpots.find(x => x.id === r.id);
    if (s) s.status = 'free';
    myReservations.splice(i, 1);
    renderSpots(); updateStats();
}};

function updatePremiumUI() {{
    const st = document.getElementById('premium-status');
    const btn = document.getElementById('premium-btn');
    if (st) st.innerHTML = window.isPremium ? 'Status: <b style="color:#4CAF50">Premium 💎</b>' : 'Status: <b>Free</b>';
    if (btn) {{ btn.innerText = window.isPremium ? '✓ Premium' : '💎 Upgrade'; btn.style.background = window.isPremium ? '#4CAF50' : '#fbbc04'; btn.style.color = window.isPremium ? 'white' : '#333'; }}
}}

window.upgradePremium = () => {{
    if (window.isPremium) {{ if (confirm("Cancel Premium?")) {{ window.isPremium = false; localStorage.setItem('loomis_premium', 'false'); updatePremiumUI(); }} return; }}
    window.isPremium = true; localStorage.setItem('loomis_premium', 'true'); updatePremiumUI();
    alert("🎉 Premium activated!");
}};

window.toggleSettings = () => {{ const p = document.getElementById('settings-panel'); if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none'; }};
window.toggleTheme = () => {{ document.body.classList.toggle('dark-mode'); localStorage.setItem('loomis_dark', document.body.classList.contains('dark-mode')); }};
'''

if __name__ == "__main__":
    extract_spots("/Users/reedfisch/.gemini/antigravity/brain/c757bc7b-f778-44ff-b2bc-52a8552e32b2/uploaded_image_1768229632862.png")

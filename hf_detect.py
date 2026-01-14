#!/usr/bin/env python3
"""
Parking spot detection using Hugging Face Inference API.
Uses the official huggingface_hub library for reliable connection.
"""

from huggingface_hub import InferenceClient
from PIL import Image
import json
import sys

HF_TOKEN = "hf_REMOVED_FOR_SECURITY"

def detect_and_generate():
    image_path = "satellite-overlay.jpg"
    
    # Get image dimensions
    with Image.open(image_path) as img:
        width, height = img.size
    print(f"Image: {width}x{height}")
    
    # Initialize client
    client = InferenceClient(token=HF_TOKEN)
    
    # Try object detection
    print("\nRunning object detection (DETR)...")
    detections = client.object_detection(image_path, model="facebook/detr-resnet-50")
    
    print(f"\nDetected {len(detections)} objects:")
    labels = {}
    for det in detections:
        label = det.label
        labels[label] = labels.get(label, 0) + 1
        score = det.score
        box = det.box
        print(f"  - {label} ({score:.2f}): {box}")
    
    print("\nLabel counts:")
    for label, count in sorted(labels.items(), key=lambda x: -x[1]):
        print(f"  {label}: {count}")
    
    # Save raw results
    results = []
    for det in detections:
        results.append({
            "label": det.label,
            "score": det.score,
            "box": {
                "xmin": det.box.xmin,
                "ymin": det.box.ymin,
                "xmax": det.box.xmax,
                "ymax": det.box.ymax
            }
        })
    
    with open("hf_detections.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nSaved: hf_detections.json")
    
    # Convert to spots (center of each detected object)
    spots = []
    for i, det in enumerate(detections, 1):
        cx = ((det.box.xmin + det.box.xmax) / 2) / width * 100
        cy = ((det.box.ymin + det.box.ymax) / 2) / height * 100
        prefix = det.label[0].upper() if det.label else "S"
        spots.append({
            "id": f"{prefix}{i}",
            "left": round(cx, 2),
            "top": round(cy, 2),
            "label": det.label,
            "score": round(det.score, 3)
        })
    
    # Generate JS
    js_defs = []
    for spot in spots:
        js_defs.append(f"    {{ id: '{spot['id']}', left: {spot['left']}, top: {spot['top']} }}, // {spot['label']} ({spot['score']})")
    
    spot_code = '\n'.join(js_defs) if js_defs else "    // No spots detected by API"
    
    js_content = f'''/* Hugging Face API detected objects */
console.log("Parking Demo (HF API) loading...");

window.isPremium = localStorage.getItem('loomis_premium') === 'true';

// Detected {len(spots)} objects via Hugging Face DETR model
const spotDefinitions = [
{spot_code}
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
        el.className = `spot ${{isRes ? 'reserved' : spot.status}}`;
        el.id = `spot-${{spot.id}}`;
        el.style.left = spot.left + '%';
        el.style.top = spot.top + '%';
        el.title = `${{spot.id}} - $${{spot.price.toFixed(2)}}/hr`;
        if (spot.status !== 'taken' && !isRes) el.onclick = () => showSpotPopup(spot);
        container.appendChild(el);
    }});
}}

function updateStats() {{
    const el = document.getElementById('stats');
    let total = allSpots.length, free = 0, taken = 0, minP = Infinity;
    allSpots.forEach(s => {{
        if (s.status === 'free') {{ free++; if (s.price < minP) minP = s.price; }}
        else if (s.status === 'taken') taken++;
    }});
    el.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:10px;">
            <div><small>TOTAL</small> <b>${{total}}</b></div>
            <div><small>TAKEN</small> <b style="color:#e53935;">${{taken}}</b></div>
            <div><small>FREE</small> <b style="color:#4CAF50;">${{free}}</b></div>
        </div>
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

window.findCheapest = () => {{ let b=null; allSpots.forEach(s=>{{ if(s.status==='free'&&!myReservations.some(r=>r.id===s.id)){{ if(!b||s.price<b.price)b=s; }} }}); if(b){{highlight(b.id);alert(`💲 Cheapest: ${{b.id}}\\n$${{b.price.toFixed(2)}}/hr`);}}else alert("No spots!"); }};
window.findClosest = () => {{ const f=allSpots.find(s=>s.status==='free'&&!myReservations.some(r=>r.id===s.id)); if(f){{highlight(f.id);alert(`📍 Closest: ${{f.id}}\\n$${{f.price.toFixed(2)}}/hr`);}}else alert("No spots!"); }};
function highlight(id) {{ document.querySelectorAll('.spot').forEach(e=>e.style.outline=''); const el=document.getElementById(`spot-${{id}}`); if(el){{el.style.outline='3px solid #FFD700';el.scrollIntoView({{behavior:'smooth',block:'center'}});}} }}
function showSpotPopup(spot) {{ const o=document.createElement('div'); o.className='popup-overlay'; o.onclick=e=>{{if(e.target===o)o.remove();}}; o.innerHTML=`<div class="popup-card"><h3>🅿️ Spot ${{spot.id}}</h3><p>Rate: $${{spot.price.toFixed(2)}}/hr</p><button onclick="reserveNow('${{spot.id}}')" style="width:100%;background:#4CAF50;color:white;border:none;padding:10px;border-radius:6px;cursor:pointer;">✓ Reserve</button></div>`; document.body.appendChild(o); }}
window.reserveNow = id => {{ const s=allSpots.find(x=>x.id===id); if(!s)return; s.status='taken'; myReservations.push({{id:s.id,price:s.price}}); document.querySelector('.popup-overlay')?.remove(); renderSpots();updateStats(); alert(`✅ Reserved: ${{id}}`); }};
window.endReservation = i => {{ const r=myReservations[i]; const s=allSpots.find(x=>x.id===r.id); if(s)s.status='free'; myReservations.splice(i,1); renderSpots();updateStats(); }};
function updatePremiumUI() {{ const st=document.getElementById('premium-status'); const btn=document.getElementById('premium-btn'); if(st)st.innerHTML=window.isPremium?'Status: <b style="color:#4CAF50">Premium 💎</b>':'Status: <b>Free</b>'; if(btn){{btn.innerText=window.isPremium?'✓ Premium':'💎 Upgrade';btn.style.background=window.isPremium?'#4CAF50':'#fbbc04';btn.style.color=window.isPremium?'white':'#333';}} }}
window.upgradePremium = () => {{ if(window.isPremium){{if(confirm("Cancel Premium?")){{window.isPremium=false;localStorage.setItem('loomis_premium','false');updatePremiumUI();}}return;}} window.isPremium=true;localStorage.setItem('loomis_premium','true');updatePremiumUI();alert("🎉 Premium activated!"); }};
window.toggleSettings = () => {{ const p=document.getElementById('settings-panel'); if(p)p.style.display=p.style.display==='none'?'block':'none'; }};
window.toggleTheme = () => {{ document.body.classList.toggle('dark-mode'); localStorage.setItem('loomis_dark',document.body.classList.contains('dark-mode')); }};
'''
    
    with open("demo-app.js", "w") as f:
        f.write(js_content)
    print(f"Saved: demo-app.js with {len(spots)} spots")
    
    return spots

if __name__ == "__main__":
    spots = detect_and_generate()
    print(f"\n✓ Done! Detected {len(spots)} objects. Refresh demo.html to see.")

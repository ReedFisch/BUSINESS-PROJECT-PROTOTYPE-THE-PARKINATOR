import json

def analyze_mid_bottom():
    with open('detected_spots_box.js', 'r') as f:
        content = f.read()
        json_str = content.split('const spotDefinitions = ')[1].rstrip(';')
        spots = json.loads(json_str)

    mid_spots = [s for s in spots if 50.0 < s['top'] < 80.0]
    mid_spots.sort(key=lambda s: (s['top'], s['left']))
    
    print(f"Mid-bottom spots (50-80% Y): {len(mid_spots)}")
    for s in mid_spots:
        print(f"ID: {s['id']}, Type: {s['type']}, X: {s['left']}%, Y: {s['top']}%")

if __name__ == "__main__":
    analyze_mid_bottom()

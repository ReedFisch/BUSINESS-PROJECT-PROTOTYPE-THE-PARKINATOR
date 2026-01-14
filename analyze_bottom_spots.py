import json

def analyze_bottom():
    with open('detected_spots_box.js', 'r') as f:
        content = f.read()
        json_str = content.split('const spotDefinitions = ')[1].rstrip(';')
        spots = json.loads(json_str)

    bottom_spots = [s for s in spots if s['top'] > 80.0]
    bottom_spots.sort(key=lambda s: s['left'])
    
    print(f"Bottom spots ({len(bottom_spots)}):")
    for s in bottom_spots:
        print(f"ID: {s['id']}, X: {s['left']}%, Y: {s['top']}%")

if __name__ == "__main__":
    analyze_bottom()

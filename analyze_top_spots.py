import json

def analyze_top():
    with open('detected_spots_box.js', 'r') as f:
        content = f.read()
        json_str = content.split('const spotDefinitions = ')[1].rstrip(';')
        spots = json.loads(json_str)

    top_spots = [s for s in spots if s['top'] < 12.0]
    top_spots.sort(key=lambda s: s['left'])
    
    print(f"Top spots (<12% Y): {len(top_spots)}")
    for s in top_spots:
        print(f"ID: {s['id']}, X: {s['left']}%, Y: {s['top']}%")

if __name__ == "__main__":
    analyze_top()

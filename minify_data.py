import json

def minify():
    try:
        with open('parking_database.json', 'r') as f:
            data = json.load(f)
        
        minified = []
        for item in data:
            if 'latlng' not in item:
                continue
                
            # Keep only essential fields
            new_item = {
                'spaceid': item.get('spaceid'),
                'latlng': item.get('latlng'),
                'raterange': item.get('raterange'),
                'timelimit': item.get('timelimit')
            }
            minified.append(new_item)
            
        with open('parking_min.json', 'w') as f:
            json.dump(minified, f, separators=(',', ':')) # Remove whitespace
            
        print(f"Minified {len(data)} records to {len(minified)}.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    minify()

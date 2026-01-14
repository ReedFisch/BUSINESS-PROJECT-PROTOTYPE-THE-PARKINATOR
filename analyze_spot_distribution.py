import json
import numpy as np

def analyze_distribution():
    with open('detected_spots_box.js', 'r') as f:
        content = f.read()
        # Extract JSON part
        json_str = content.split('const spotDefinitions = ')[1].rstrip(';')
        spots = json.loads(json_str)

    print(f"Total spots: {len(spots)}")
    
    # Convert proportional to pixels (approx, using original image size if possible, 
    # but proportional is enough for relative clustering)
    # Actually, let's just use the 'left', 'top' pct values.
    
    coords = []
    for s in spots:
        coords.append([s['left'], s['top']])
    
    coords = np.array(coords)
    
    coords = np.array(coords)
    
    # Clustering (Manual)
    
    clusters = []
    visited = set()
    
    # Threshold in % (e.g. 5% distance)
    # The map is 100% wide. A spot is maybe 2-3% wide.
    # Gap between rows is small. Gap between major sections might be larger.
    dist_thresh = 5.0 
    
    for i in range(len(spots)):
        if i in visited: continue
        
        cluster = [i]
        queue = [i]
        visited.add(i)
        
        while queue:
            curr = queue.pop(0)
            c_x, c_y = coords[curr]
            
            for j in range(len(spots)):
                if j in visited: continue
                
                d_x, d_y = coords[j]
                dist = np.sqrt((c_x - d_x)**2 + (c_y - d_y)**2)
                
                if dist < dist_thresh:
                    visited.add(j)
                    cluster.append(j)
                    queue.append(j)
        
        clusters.append(cluster)
        
    print(f"Found {len(clusters)} clusters.")
    
    for idx, cl in enumerate(clusters):
        # Calc bounds
        cl_coords = coords[cl]
        min_x, min_y = np.min(cl_coords, axis=0)
        max_x, max_y = np.max(cl_coords, axis=0)
        
        print(f"Cluster {idx+1}: {len(cl)} spots.")
        print(f"  Bounds: X[{min_x:.1f}% - {max_x:.1f}%], Y[{min_y:.1f}% - {max_y:.1f}%]")
        
        # Print a few examples to correlate with visual
        # print(f"  Example IDs: {[spots[i]['id'] for i in cl[:5]]}")

if __name__ == "__main__":
    analyze_distribution()

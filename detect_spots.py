import cv2
import numpy as np
import json

def find_spots():
    img = cv2.imread('parking-layout.jpg')
    if img is None:
        print("Error: Could not read image")
        return

    h, w = img.shape[:2]
    # print(f"DEBUG: Image H={h} W={w}")
    
    # Convert to HSV
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Define colors
    # Cyan/Blue: ~180-200 Hue in generic terms, but in OpenCV Hue is 0-179. 
    # Cyan is around 90. Let's look at the image colors.
    # The image has bright cyan and magenta.
    
    # Cyan mask (Blue spots)
    lower_cyan = np.array([80, 50, 50])
    upper_cyan = np.array([100, 255, 255])
    mask_cyan = cv2.inRange(hsv, lower_cyan, upper_cyan)

    # Magenta mask (Pink spots)
    # Magenta is around 150-170
    lower_magenta = np.array([140, 50, 50])
    upper_magenta = np.array([170, 255, 255])
    mask_magenta = cv2.inRange(hsv, lower_magenta, upper_magenta)

    # Erode masks to separate spots (the white lines might be thin)
    # Use a vertical kernel to separate horizontal neighbors?
    # Spots are side-by-side. Vertical line separates them.
    kernel = np.ones((3,3), np.uint8)
    mask_cyan = cv2.erode(mask_cyan, kernel, iterations=3)
    mask_magenta = cv2.erode(mask_magenta, kernel, iterations=3)

    spots = []
    
    def get_spot_center(x, y, w, h):
        return x + w / 2, y + h / 2

    def process_mask(mask, type_name):
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        block_spots = []
        # Calculate median height to detect double-rows
        valid_heights = [cv2.boundingRect(c)[3] for c in contours if cv2.boundingRect(c)[3] > 5]
        median_h = np.median(valid_heights) if valid_heights else 0
        
        block_spots = []
        for c in contours:
            x, y, bw, bh = cv2.boundingRect(c)
            # print(f"DEBUG: Rect at {y} height={bh} width={bw}") # Debugging
            if bw < 5 or bh < 5: continue 
            
            # Check if this is a Double Row (Top/Middle blocks)
            # Use relative height threshold. Single spot is ~8%, Double is ~16%.
            # Threshold > 8% (0.08)
            rows_in_block = 1
            if (bh / h) > 0.08:
                rows_in_block = 2
                # print(f"DEBUG: Double row detected at {y} (Ratio {bh/h:.3f} > 0.08)")
            else:
                # print(f"DEBUG: Single row detected at {y} (Ratio {bh/h:.3f} <= 0.08)")
                pass
            
            row_height = bh / rows_in_block
            
            for r in range(rows_in_block):
                # Define the sub-block for this row
                # Top row is r=0, Bottom row is r=1
                row_y = y + (r * row_height)
                row_h = row_height
                
                # Further split horizontally if needed (for adjacent spots in a row)
                # Check aspect of this sub-row
                aspect = bw / float(row_h)
                
                # Normalize dimensions for calculations
                nw = (bw / w) * 100
                nh = (row_h / h) * 100
                
                estimated_spots = 1
                if aspect > 1.0:
                     divisor = 0.28
                     if type_name == 'disability': divisor = 0.55
                     spot_w_approx = nh * divisor 
                     estimated_spots = max(1, round(nw / spot_w_approx))
                
                if estimated_spots > 1:
                    step = bw / estimated_spots
                    for i in range(estimated_spots):
                        sub_x = x + (step * i)
                        sub_w = step
                        
                        sub_cx, sub_cy = get_spot_center(sub_x, row_y, sub_w, row_h)
                        n_sub_cx = (sub_cx / w) * 100
                        n_cy = (sub_cy / h) * 100
                        
                        block_spots.append({
                            'left': round(n_sub_cx, 2),
                            'top': round(n_cy, 2),
                            'type': type_name,
                            'cx': sub_cx,
                            'cy': sub_cy
                        })
                else:
                    cx, cy = get_spot_center(x, row_y, bw, row_h)
                    nx = (cx / w) * 100
                    ny = (cy / h) * 100
                    
                    block_spots.append({
                        'left': round(nx, 2),
                        'top': round(ny, 2),
                        'type': type_name,
                        'cx': cx,
                        'cy': cy
                    })
                
        return block_spots

    spots.extend(process_mask(mask_cyan, 'regular'))
    spots.extend(process_mask(mask_magenta, 'disability'))

    # Sort spots to name them intelligently
    # 1. Cluster by Y (Rows)
    spots.sort(key=lambda s: s['cy'])
    
    rows = []
    current_row = []
    last_y = -100
    
    for s in spots:
        if not current_row:
            current_row.append(s)
            last_y = s['cy']
        else:
            if abs(s['cy'] - last_y) < (h * 0.05): # within 5% height shared row
                current_row.append(s)
                # update avg y? keep it simple
            else:
                rows.append(current_row)
                current_row = [s]
                last_y = s['cy']
    if current_row:
        rows.append(current_row)

    final_definitions = []
    
    row_labels = ['A', 'B', 'C', 'D', 'E'] # Simplistic labeling
    
    for idx, row in enumerate(rows):
        # Sort row by X
        row.sort(key=lambda s: s['cx'])
        label = row_labels[idx] if idx < len(row_labels) else f'R{idx}'
        
        for s_idx, s in enumerate(row):
            def_obj = {
                'id': f"{label}{s_idx + 1}",
                'left': s['left'],
                'top': s['top'],
                'type': s['type']
            }
            final_definitions.append(def_obj)

    print(json.dumps(final_definitions, indent=4))

if __name__ == "__main__":
    find_spots()

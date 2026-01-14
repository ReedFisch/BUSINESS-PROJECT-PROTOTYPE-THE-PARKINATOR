import cv2
import numpy as np
import json
import os

# --- Configuration ---
# Image Path
image_path = "/Users/reedfisch/.gemini/antigravity/brain/c757bc7b-f778-44ff-b2bc-52a8552e32b2/uploaded_image_1768277321838.png"

# Colors (HSV in OpenCV: H=0-179, S=0-255, V=0-255)
# Wide ranges to catch all spot pixels (merged rows)
orange_lower = np.array([5, 120, 120])
orange_upper = np.array([35, 255, 255])

blue_lower = np.array([90, 100, 100])
blue_upper = np.array([130, 255, 255])


def detect_exact_spots():
    # 1. Load Image
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return

    image = cv2.imread(image_path)
    if image is None:
        print("Error: Could not read image.")
        return
    
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, w = image.shape[:2]
    print(f"Image Dimensions: {w}x{h}")

    # 2. Create Masks
    mask_orange = cv2.inRange(hsv, orange_lower, orange_upper)
    mask_blue = cv2.inRange(hsv, blue_lower, blue_upper)
    
    # Clean up small noise but keep rows intact
    kernel = np.ones((3,3), np.uint8)
    
    # DILATE to merge fragments (filling holes/gaps)
    # We rely on geometric splitting for rows, so merging is fine/good.
    mask_orange = cv2.dilate(mask_orange, kernel, iterations=2)
    mask_blue = cv2.dilate(mask_blue, kernel, iterations=2)
    # Then slight erode to tidy edges? No, leave it broad.

    # 3. Find Contours
    contours_orange, _ = cv2.findContours(mask_orange, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours_blue, _ = cv2.findContours(mask_blue, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    print(f"Raw Orange Contours: {len(contours_orange)}")
    print(f"Raw Blue Contours: {len(contours_blue)}")
    
    debug_img = image.copy()
    raw_spots = []

    # Helper to process contours with Projection Splitting
    def process_contours(contours, spot_type):
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 50: continue
            
            x, y, bw, bh = cv2.boundingRect(cnt)
            
            # Filter by dimensions (Noise removal)
            if bw < 5 or bh < 5: continue
            
            # Extract ROI mask
            roi = mask_orange[y:y+bh, x:x+bw] if spot_type == 'regular' else mask_blue[y:y+bh, x:x+bw]
            
            # Vertical Projection (Sum of white pixels in each column)
            projection = np.sum(roi, axis=0)
            
            # Simple peak/valley finding to split rows
            # A typical spot is roughly 20-25px wide based on 1024 width?
            # Or 2.3% width = 23px.
            
            # If width > 40, likely multiple spots.
            num_spots_est = round(bw / 23.0)
            if num_spots_est < 1: num_spots_est = 1
            
            # If it's a single spot, just take center
            if num_spots_est == 1:
                 # Check if it's a TALL single spot (vertical stack)
                 # H ~ 7.6% = 56px.
                 # If H > 80, likely duplicate vertically.
                 num_v = round(bh / 56.0)
                 if num_v > 1:
                     # Vertical Split Logic (Fallback to simple slicing for vertical stacks)
                     step_h = bh / num_v
                     for k in range(num_v):
                         cy = y + (step_h * k) + (step_h/2)
                         # Simple center x
                         M = cv2.moments(cnt)
                         cx = (M["m10"] / M["m00"]) if M["m00"] != 0 else x + bw/2
                         raw_spots.append({ "cx": cx, "cy": cy, "x": x, "y": y, "w": bw, "h": step_h, "type": spot_type })
                         cv2.circle(debug_img, (int(cx), int(cy)), 3, (0, 0, 255), -1)
                 else:
                     M = cv2.moments(cnt)
                     cx = (M["m10"] / M["m00"]) if M["m00"] != 0 else x + bw/2
                     cy = (M["m01"] / M["m00"]) if M["m00"] != 0 else y + bh/2
                     raw_spots.append({ "cx": cx, "cy": cy, "x": x, "y": y, "w": bw, "h": bh, "type": spot_type })
                     cv2.circle(debug_img, (int(cx), int(cy)), 3, (0, 0, 255), -1)
            else:
                # Horizontal Split Logic (for rows)
                # Instead of finding complex valleys, let's assume equal spacing if projection is noisy
                # Step W
                step_w = bw / num_spots_est
                
                # Check constraints (e.g. if contour is tall)
                num_v = round(bh / 56.0)
                
                for i in range(num_spots_est):
                    # Segment center X
                    cx_seg = x + (step_w * i) + (step_w/2)
                    
                    if num_v > 1:
                         # Double stack in a row? (e.g. regular spots usually single row)
                         # Assuming regular rows are single height for now unless detected otherwise
                         step_h = bh / num_v
                         for k in range(num_v):
                             cy_seg = y + (step_h * k) + (step_h/2)
                             raw_spots.append({ "cx": cx_seg, "cy": cy_seg, "x": x + i*step_w, "y": y + k*step_h, "w": step_w, "h": step_h, "type": spot_type })
                             cv2.circle(debug_img, (int(cx_seg), int(cy_seg)), 3, (0, 0, 255), -1)
                    else:
                        cy_seg = y + bh/2
                        raw_spots.append({ "cx": cx_seg, "cy": cy_seg, "x": x + i*step_w, "y": y, "w": step_w, "h": bh, "type": spot_type })
                        cv2.circle(debug_img, (int(cx_seg), int(cy_seg)), 3, (0, 0, 255), -1)
                
            # Draw debug box
            color = (0, 255, 0) if spot_type == 'regular' else (255, 0, 0)
            cv2.rectangle(debug_img, (x, y), (x+bw, y+bh), color, 1)

    process_contours(contours_orange, "regular")
    process_contours(contours_blue, "disability")

    # 4. Sort Spots (Row by Row)
    # Sort roughly by Y then X
    # FIRST: Filter out false positives (Spatial)
    filtered_spots = []
    for s in raw_spots:
        # Calculate percentages
        left_pct = (s['cx'] / w) * 100
        top_pct = (s['cy'] / h) * 100
        
        # Filter right side artifacts
        if left_pct > 80.0: continue
        
        # Filter bottom false positive row (below disability row)
        if top_pct > 60.0: continue
        
        filtered_spots.append(s)
    
    raw_spots = filtered_spots
    
    raw_spots.sort(key=lambda s: s['cy'])

    rows = []
    current_row = []
    
    if not raw_spots:
        print("No spots detected!")
        return

    # Row grouping logic (simple Y threshold)
    last_y = raw_spots[0]['cy']
    
    for spot in raw_spots:
        if abs(spot['cy'] - last_y) > 30: # New row threshold (pixels)
            rows.append(current_row)
            current_row = []
            last_y = spot['cy']
        current_row.append(spot)
    rows.append(current_row)

    final_spots = []
    row_labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

    for i, row in enumerate(rows):
        label = row_labels[i] if i < len(row_labels) else f"R{i}"
        # Sort row by X
        row.sort(key=lambda s: s['cx'])
        
        for j, spot in enumerate(row):
            spot_id = f"{label}{j+1}"
            
            # Convert to percentages
            left_pct = (spot['cx'] / w) * 100
            top_pct = (spot['cy'] / h) * 100
            width_pct = (spot['w'] / w) * 100
            height_pct = (spot['h'] / h) * 100

            final_spots.append({
                "id": spot_id,
                "left": round(left_pct, 2),
                "top": round(top_pct, 2),
                "width": round(width_pct, 2),
                "height": round(height_pct, 2),
                "type": spot['type']
            })
            
            # Label debug image
            cv2.putText(debug_img, spot_id, (int(spot['cx'])-10, int(spot['cy'])-5), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 255, 255), 1)

    # 5. Output
    print(f"Detected {len(final_spots)} spots.")
    
    js_content = "const spotDefinitions = " + json.dumps(final_spots, indent=4) + ";"
    with open('detected_spots_box.js', 'w') as f:
        f.write(js_content)
        
    cv2.imwrite('debug_exact_detection.png', debug_img)
    print("Saved detected_spots_box.js and debug_exact_detection.png")

if __name__ == "__main__":
    detect_exact_spots()

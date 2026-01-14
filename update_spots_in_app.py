import os

# Paths
spots_file = '/Users/reedfisch/Documents/Projects/BUSINESS PROTOTYPE 1 - THE PARKINATOR/detected_spots_box.js'
app_file = '/Users/reedfisch/Documents/Projects/BUSINESS PROTOTYPE 1 - THE PARKINATOR/demo-app.js'

# Read new spots
with open(spots_file, 'r') as f:
    new_spots_content = f.read().strip()
    # Remove semicolon at end if present to handle potential issues, but it should be fine.
    # Actually, the file ends with "];" which is correct for valid JS.

# Read app file
with open(app_file, 'r') as f:
    app_lines = f.readlines()

# Find where logic starts. 
# We look for "const priceTiers =" which marks the start of the logic after the big array.
logic_start_index = -1
for i, line in enumerate(app_lines):
    if "const priceTiers =" in line:
        logic_start_index = i
        break

if logic_start_index == -1:
    print("Error: Could not find start of logic in demo-app.js")
    exit(1)

# Extract logic part
logic_content = "".join(app_lines[logic_start_index:])

# Combine
new_app_content = new_spots_content + "\n\n" + logic_content

# Write back
with open(app_file, 'w') as f:
    f.write(new_app_content)

print("Successfully updated demo-app.js with new spots.")

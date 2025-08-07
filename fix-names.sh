#!/bin/bash

# This script helps fix case-sensitivity issues with Git on Windows and macOS.
# It renames all .png and .css files to a temporary name,
# then renames them back to their lowercase names to force Git to
# recognize the change.

# First, rename all .png files to a temporary name.
# This makes sure Git sees them as removed.
for file in *.png; do
  if [ -f "$file" ]; then
    git mv "$file" "${file}.temp"
  fi
done

# Now, rename the temporary files to their correct lowercase names.
# This makes sure Git sees them as new files.
for file in *.png.temp; do
  if [ -f "$file" ]; then
    new_name=$(echo "$file" | sed 's/\.temp//' | tr '[:upper:]' '[:lower:]')
    git mv "$file" "$new_name"
  fi
done

# Also handle the CSS file since it's showing an error in your Vercel logs.
git mv styles.css styles.css.temp
git mv styles.css.temp styles.css

# Now, commit the changes.
git commit -m "Corrected file name capitalization for server"

# Push the changes to GitHub.
git push

echo "File names have been updated and pushed. Check your GitHub repository to confirm."

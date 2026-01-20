#!/bin/bash

# Clean Build Script for Xcode
# Removes all cached build artifacts and rebuilds from scratch

echo "🧹 Cleaning Xcode build cache..."

# Clean Xcode DerivedData (where the error is cached)
rm -rf ~/Library/Developer/Xcode/DerivedData/AtelicStable-*

echo "✅ Cleaned Xcode DerivedData"

# Clean iOS build folder
cd ios
xcodebuild clean -workspace AtelicStable.xcworkspace -scheme AtelicStable
echo "✅ Cleaned Xcode workspace"

cd ..
echo ""
echo "🎉 Clean complete!"
echo ""
echo "Now run: npx expo run:ios --device"

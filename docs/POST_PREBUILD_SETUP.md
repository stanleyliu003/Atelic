# Post-Prebuild Setup Guide

## What Happens During Prebuild

When you run `npx expo prebuild --clean`, the config plugin automatically:

✅ Copies `ShareViewController.swift` and `Info.plist` to `ios/AtelicShareExtension/`  
✅ Copies `AppGroupsStorage.swift` and `AppGroupsStorage.m` to `ios/`  
✅ Adds App Groups entitlement to main app  
✅ Adds `atelic://` URL scheme  

## Manual Xcode Setup Required

Unfortunately, Expo config plugins cannot fully automate Xcode project configuration. You need to manually add the files to Xcode targets.

### Step 1: Open Xcode Project

```bash
cd ios
open AtelicStable.xcworkspace
```

### Step 2: Add AppGroupsStorage Native Module

1. In Xcode, right-click on `AtelicStable` folder (not the project root, the blue folder icon)
2. Select **"Add Files to AtelicStable..."**
3. Navigate to the `ios/` directory (you should already be there)
4. Select both files:
   - `AppGroupsStorage.swift`
   - `AppGroupsStorage.m`
5. **Important:** Check these options:
   - ✅ **Copy items if needed** (uncheck this - files are already in place)
   - ✅ **Create groups** (not folder references)
   - ✅ **Add to targets:** Select `AtelicStable` (main app target)
6. Click **"Add"**

### Step 3: Add Share Extension Target (If Not Already Added)

If this is your first time or you did a clean prebuild:

1. Click on the project root (blue icon at top)
2. Click the **"+"** button at bottom of targets list
3. Select **"Share Extension"**
4. Name: `AtelicShareExtension`
5. Bundle ID: `com.atelic.app.AtelicShareExtension`
6. Click **"Finish"**
7. When prompted about activating scheme, click **"Cancel"**

### Step 4: Add Share Extension Files to Target

1. In Project Navigator, find `AtelicShareExtension` folder
2. You should see:
   - `ShareViewController.swift` (already there from plugin)
   - `Info.plist` (already there from plugin)

If files are missing:
1. Right-click `AtelicShareExtension` folder
2. Select **"Add Files to AtelicShareExtension..."**
3. Navigate to `ios/AtelicShareExtension/`
4. Select `ShareViewController.swift` and `Info.plist`
5. **Add to targets:** Select `AtelicShareExtension`

### Step 5: Configure App Groups

**For Main App (AtelicStable):**
1. Select `AtelicStable` project → `AtelicStable` target
2. Go to **"Signing & Capabilities"** tab
3. If "App Groups" capability is not present:
   - Click **"+ Capability"**
   - Search for and add **"App Groups"**
4. Check the box for: `group.com.atelic.shared`

**For Share Extension (AtelicShareExtension):**
1. Select `AtelicStable` project → `AtelicShareExtension` target
2. Go to **"Signing & Capabilities"** tab
3. If "App Groups" capability is not present:
   - Click **"+ Capability"**
   - Add **"App Groups"**
4. Check the box for: `group.com.atelic.shared`

### Step 6: Configure Share Extension Settings

1. Select `AtelicStable` project → `AtelicShareExtension` target
2. Go to **"General"** tab
3. Set **Deployment Target:** iOS 13.4 (or match main app)
4. Verify **Bundle Identifier:** `com.atelic.app.AtelicShareExtension`

### Step 7: Verify Build Settings

1. Select `AtelicStable` project → `AtelicShareExtension` target
2. Go to **"Build Settings"** tab
3. Search for **"Swift Language Version"**
4. Set to **Swift 5** (or match main app)

### Step 8: Build and Test

```bash
# Clean build
cd ios
xcodebuild clean
cd ..

# Build and run
npx expo run:ios
```

## Verification Checklist

After setup, verify:

- [ ] Main app builds without errors
- [ ] Console shows: `[AppGroups] Stored value for key: userID` after login
- [ ] Share Extension appears in iOS share sheet from Instagram
- [ ] Share Extension can read userID when logged in
- [ ] Share Extension shows "not logged in" when logged out

## Common Issues

### Issue: "Module 'AppGroupsStorage' not found"

**Cause:** Native module not added to Xcode project

**Solution:**
1. Verify `AppGroupsStorage.swift` and `.m` are in Project Navigator
2. Check files are added to `AtelicStable` target (not Share Extension)
3. Clean and rebuild

### Issue: Share Extension doesn't appear in share sheet

**Cause:** Share Extension target not configured correctly

**Solution:**
1. Verify `AtelicShareExtension` target exists
2. Check `Info.plist` has `NSExtension` configuration
3. Verify Bundle ID matches: `com.atelic.app.AtelicShareExtension`
4. Check App Groups capability is enabled

### Issue: "Undefined symbol: _OBJC_CLASS_$_RCTBridgeModule"

**Cause:** Missing React Native framework linkage

**Solution:**
1. Select `AtelicStable` target → **"Build Phases"**
2. Expand **"Link Binary With Libraries"**
3. Click **"+"** and add `React-Core` if missing

### Issue: Files copied to wrong location

**Cause:** Config plugin ran before files existed

**Solution:**
```bash
# Ensure files exist in native-files/ios/
ls native-files/ios/AppGroupsStorage.swift
ls native-files/ios/AppGroupsStorage.m
ls native-files/ios/AtelicShareExtension/ShareViewController.swift

# Run prebuild again
npx expo prebuild --clean
```

## Next Steps

Once Xcode setup is complete:

1. Follow **Phase 4 Testing Guide** (`docs/PHASE_4_TESTING_GUIDE.md`)
2. Test all authentication flows
3. Test Share Extension with Instagram
4. Move to Phase 3: Main App UI

## Quick Reference

**Files Created by Plugin:**
```
ios/
├── AppGroupsStorage.swift      ← Native module (add to main target)
├── AppGroupsStorage.m          ← Native module bridge (add to main target)
└── AtelicShareExtension/
    ├── ShareViewController.swift  ← Share Extension UI
    └── Info.plist                 ← Extension config
```

**App Groups ID:** `group.com.atelic.shared`  
**Share Extension Bundle ID:** `com.atelic.app.AtelicShareExtension`  
**URL Scheme:** `atelic://`

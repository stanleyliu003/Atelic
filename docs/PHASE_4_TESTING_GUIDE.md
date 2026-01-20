# Phase 4: Testing Guide & Next Steps

## 🧪 Testing Phase 4 Implementation

### Prerequisites

Before testing, you need to:

1. **Add native files to Xcode project** (if not already added):
   ```bash
   # Run prebuild to regenerate native iOS project
   npx expo prebuild --clean
   ```

2. **Manually add native module files to Xcode:**
   - Open `ios/AtelicStable.xcworkspace` in Xcode
   - Right-click on `AtelicStable` folder in Project Navigator
   - Select "Add Files to AtelicStable..."
   - Navigate to and select:
     - `ios/AppGroupsStorage.swift`
     - `ios/AppGroupsStorage.m`
   - Ensure "Copy items if needed" is checked
   - Ensure target "AtelicStable" is selected

3. **Verify App Groups capability:**
   - Select `AtelicStable` project → `AtelicStable` target
   - Go to "Signing & Capabilities" tab
   - Verify "App Groups" capability is present
   - Verify `group.com.atelic.shared` is checked
   - Repeat for `AtelicShareExtension` target

4. **Rebuild the app:**
   ```bash
   # Clean and rebuild
   cd ios
   xcodebuild clean
   cd ..
   npx expo run:ios
   ```

### Test Cases

#### Test 1: Email/Password Sign-In
1. Open app
2. Navigate to "Sign In" → "Sign up with email"
3. Sign in with test credentials
4. **Expected:** Console shows `[SignIn] Stored auth data in App Groups`
5. **Verify:** Check Xcode device logs for `[AppGroups] Stored value for key: userID`

#### Test 2: Google OAuth Sign-In
1. Open app
2. Tap "Sign up with Google"
3. Complete Google sign-in flow
4. **Expected:** Console shows `[SignIn] Stored auth data in App Groups (Google)`
5. **Verify:** User redirects to app successfully

#### Test 3: Apple OAuth Sign-In
1. Open app
2. Tap "Sign up with Apple"
3. Complete Apple sign-in flow
4. **Expected:** Console shows `[SignIn] Stored auth data in App Groups (Apple)`
5. **Verify:** User redirects to app successfully

#### Test 4: Share Extension - Logged In
1. Ensure you're logged into Atelic app
2. Open Instagram app
3. Find a travel post/reel
4. Tap Share → Share to... → Atelic
5. **Expected:** Share Extension shows "Finding places from this post..."
6. **Expected:** No "Please log in" message
7. **Expected:** Share Extension calls Lambda with userID

**Debug in Xcode:**
```swift
// Add breakpoint in ShareViewController.swift line 143
return sharedDefaults.string(forKey: "userID")
```

#### Test 5: Share Extension - Not Logged In
1. Logout from Atelic app (Profile → Settings → Logout)
2. **Expected:** Console shows `[Profile] Cleared auth data from App Groups`
3. Open Instagram app
4. Try to share a post to Atelic
5. **Expected:** Share Extension shows "Please log in to Atelic first"
6. **Expected:** Tapping opens main Atelic app to login

#### Test 6: Logout Clears Auth Data
1. Login to app
2. Go to Profile → Settings → Logout
3. **Expected:** Console shows `[Profile] Cleared auth data from App Groups`
4. Try Test 5 to verify Share Extension can't access userID

#### Test 7: Account Deletion Clears Auth Data
1. Login to app
2. Go to Profile → Settings → Delete Account
3. Complete deletion flow
4. **Expected:** Console shows `[Profile] Cleared auth data from App Groups (account deletion)`
5. **Expected:** User redirected to login screen

#### Test 8: Auth Persists Across App Restarts
1. Login to app
2. Force quit app (swipe up in app switcher)
3. Reopen app
4. **Expected:** Console shows `[Login] Stored/updated auth data in App Groups`
5. **Expected:** User remains logged in
6. Test Share Extension still works

### Debugging Commands

**View Console Logs:**
```bash
# Terminal 1: Metro bundler
npx expo start

# Terminal 2: Xcode device logs
xcrun simctl spawn booted log stream --level=debug | grep -i "appgroups\|shareextension"
```

**Check UserDefaults directly (Simulator only):**
```bash
# Find app container
xcrun simctl get_app_container booted com.atelic.app data

# Navigate to shared container
cd ~/Library/Developer/CoreSimulator/Devices/[DEVICE_ID]/data/Containers/Shared/AppGroup/[GROUP_ID]/Library/Preferences/

# View contents
plutil -p group.com.atelic.shared.plist
```

### Expected Console Output

**Successful Login:**
```
[SignIn] Stored auth data in App Groups
[AppGroups] Stored value for key: userID
[AppGroups] Stored value for key: cognitoIdToken
[AppGroups] Stored value for key: isLoggedIn
```

**Successful Logout:**
```
[Profile] Cleared auth data from App Groups
[AppGroups] Removed value for key: userID
[AppGroups] Removed value for key: cognitoIdToken
[AppGroups] Removed value for key: isLoggedIn
[AppGroups] Cleared all auth data
```

**Share Extension (Logged In):**
```
[ShareExtension] Found Instagram URL: https://instagram.com/p/...
[ShareExtension] User ID: abc123...
[ShareExtension] Calling Lambda...
```

**Share Extension (Not Logged In):**
```
[ShareExtension] Found Instagram URL: https://instagram.com/p/...
[ShareExtension] No user ID found
[ShareExtension] Showing not logged in message
```

## ⚠️ Common Issues

### Issue: Native module not found
**Error:** `undefined is not an object (evaluating 'NativeModules.AppGroupsStorage')`

**Solution:**
1. Verify native files are added to Xcode project
2. Clean and rebuild: `cd ios && xcodebuild clean && cd ..`
3. Rebuild app: `npx expo run:ios`

### Issue: Share Extension shows "Please log in" even when logged in
**Causes:**
- App Groups capability not enabled
- App Group ID mismatch
- Native module not storing data correctly

**Solution:**
1. Check App Groups in Xcode (both targets)
2. Verify App Group ID: `group.com.atelic.shared`
3. Check console for `[AppGroups]` messages
4. Add debug logging to `getUserID()` in Swift

### Issue: App crashes on login
**Causes:**
- Native module crash
- Swift/Objective-C bridge error

**Solution:**
1. Check Xcode crash logs
2. Verify `AppGroupsStorage.m` bridge is correct
3. Check Swift syntax in `AppGroupsStorage.swift`

## 📝 Next Steps: Phase 3 Implementation

Now that authentication is working, implement Phase 3:

### 1. Create Saved Places Screen
- **Location:** `app/(tabs)/saved-places.jsx` or `src/screens/SavedPlacesScreen.tsx`
- **Features:**
  - List saved activities from DynamoDB
  - Group by city
  - Swipe to delete
  - "Add to Trip" button
  - "Add to Wishlist" button

### 2. Add Deep Link Handler
- **File:** `app/_layout.tsx` or `App.js`
- **URL:** `atelic://instagram-import`
- **Action:** Navigate to Saved Places tab

### 3. Create Lambda Query Function
- **Function:** `getSavedPlaces`
- **Purpose:** Query `SavedPlacesStorage` by userID
- **GSI:** Use `CityIndex` to group by city

### 4. GraphQL Integration
Add GraphQL query for saved places:
```graphql
query GetSavedPlaces($userID: String!) {
  getSavedPlaces(userID: $userID) {
    savedPlaceId
    activity
    city
    source
    sourceUrl
    savedAt
  }
}
```

### 5. UI Components Needed
- `SavedPlaceCard.tsx` - Display single saved place
- `SavedPlacesList.tsx` - List of saved places
- `CitySection.tsx` - Group places by city
- `AddToTripModal.tsx` - Select trip to add place to

## 📊 Success Criteria

Phase 4 is complete when:
- ✅ All login flows store auth data in App Groups
- ✅ All logout flows clear auth data from App Groups
- ✅ Share Extension can read userID when logged in
- ✅ Share Extension shows "not logged in" when logged out
- ✅ Auth data persists across app restarts
- ✅ No crashes or errors in console

## 📞 Support

If you encounter issues:
1. Check console logs for error messages
2. Review Xcode device logs
3. Verify native module is linked
4. Test on physical device (Share Extensions have limitations on simulator)

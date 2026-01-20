/**
 * AppGroupsStorage - Native Module
 * 
 * Provides React Native access to iOS App Groups shared storage.
 * Used to share authentication data between main app and Share Extension.
 */

import Foundation
import React

@objc(AppGroupsStorage)
class AppGroupsStorage: NSObject {
  
  private let appGroupID = "group.com.atelic.shared"
  
  // MARK: - Set Value
  @objc
  func setGroupValue(_ value: String, forKey key: String) {
    guard let sharedDefaults = UserDefaults(suiteName: appGroupID) else {
      print("[AppGroups] Failed to access App Group: \(appGroupID)")
      return
    }
    sharedDefaults.set(value, forKey: key)
    sharedDefaults.synchronize()
    print("[AppGroups] Stored value for key: \(key)")
  }
  
  // MARK: - Get Value
  @objc
  func getValue(_ key: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = UserDefaults(suiteName: appGroupID) else {
      rejecter("APP_GROUPS_ERROR", "Failed to access App Group", nil)
      return
    }
    
    if let value = sharedDefaults.string(forKey: key) {
      resolver(value)
    } else {
      resolver(NSNull())
    }
  }
  
  // MARK: - Remove Value
  @objc
  func removeValue(_ key: String) {
    guard let sharedDefaults = UserDefaults(suiteName: appGroupID) else {
      print("[AppGroups] Failed to access App Group: \(appGroupID)")
      return
    }
    sharedDefaults.removeObject(forKey: key)
    sharedDefaults.synchronize()
    print("[AppGroups] Removed value for key: \(key)")
  }
  
  // MARK: - Clear All
  @objc
  func clearAll() {
    guard let sharedDefaults = UserDefaults(suiteName: appGroupID) else {
      print("[AppGroups] Failed to access App Group: \(appGroupID)")
      return
    }
    
    // Remove all keys we use for auth
    let keys = ["userID", "cognitoIdToken", "isLoggedIn"]
    for key in keys {
      sharedDefaults.removeObject(forKey: key)
    }
    sharedDefaults.synchronize()
    print("[AppGroups] Cleared all auth data")
  }
  
  // MARK: - React Native Bridge
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}

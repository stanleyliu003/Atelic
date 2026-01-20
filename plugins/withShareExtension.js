/**
 * Expo Config Plugin: iOS Share Extension
 * 
 * This plugin adds an iOS Share Extension target to the Xcode project,
 * enabling users to share Instagram posts/reels directly to Atelic.
 * 
 * Reference: docs/INSTAGRAM_SHARE_IMPLEMENTATION_PLAN.md
 */

const {
  withAppDelegate,
  withInfoPlist,
  withXcodeProject,
  withEntitlementsPlist,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHARE_EXTENSION_NAME = 'AtelicShareExtension';
const SHARE_EXTENSION_BUNDLE_ID = 'AtelicStable.ShareExtension';
const APP_GROUP_ID = 'group.com.atelic.shared';

/**
 * Main plugin function
 */
function withShareExtension(config) {
  // Add App Groups entitlement to main app
  config = withEntitlementsPlist(config, (config) => {
    if (!config.modResults['com.apple.security.application-groups']) {
      config.modResults['com.apple.security.application-groups'] = [];
    }
    if (!config.modResults['com.apple.security.application-groups'].includes(APP_GROUP_ID)) {
      config.modResults['com.apple.security.application-groups'].push(APP_GROUP_ID);
    }
    return config;
  });

  // Add URL scheme for deep linking
  config = withInfoPlist(config, (config) => {
    if (!config.modResults.CFBundleURLTypes) {
      config.modResults.CFBundleURLTypes = [];
    }
    
    const existingScheme = config.modResults.CFBundleURLTypes.find(
      (type) => type.CFBundleURLSchemes && type.CFBundleURLSchemes.includes('atelic')
    );
    
    if (!existingScheme) {
      config.modResults.CFBundleURLTypes.push({
        CFBundleTypeRole: 'Editor',
        CFBundleURLSchemes: ['atelic']
      });
    }
    
    return config;
  });

  // Add Share Extension files to iOS project
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const iosPath = path.join(config.modRequest.projectRoot, 'ios');
    const shareExtensionPath = path.join(iosPath, SHARE_EXTENSION_NAME);

    // Create Share Extension directory if it doesn't exist
    if (!fs.existsSync(shareExtensionPath)) {
      fs.mkdirSync(shareExtensionPath, { recursive: true });
      console.log(`✅ Created Share Extension directory: ${shareExtensionPath}`);
    }

    // Note: The actual Xcode target setup happens in Stage 1.2
    // This plugin mainly ensures directories and entitlements are set up
    
    return config;
  });

  return config;
}

module.exports = withShareExtension;

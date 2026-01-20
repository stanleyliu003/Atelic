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

  // Add Share Extension files and AppGroupsStorage native module to iOS project
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const iosPath = path.join(projectRoot, 'ios');
    const shareExtensionPath = path.join(iosPath, SHARE_EXTENSION_NAME);
    const sourceFilesPath = path.join(projectRoot, 'native-files', 'ios', SHARE_EXTENSION_NAME);
    const nativeModulesSourcePath = path.join(projectRoot, 'native-files', 'ios');

    // Create Share Extension directory if it doesn't exist
    if (!fs.existsSync(shareExtensionPath)) {
      fs.mkdirSync(shareExtensionPath, { recursive: true });
      console.log(`✅ Created Share Extension directory: ${shareExtensionPath}`);
    }

    // Copy Share Extension files from native-files to ios directory
    if (fs.existsSync(sourceFilesPath)) {
      const filesToCopy = ['ShareViewController.swift', 'Info.plist'];
      
      filesToCopy.forEach(file => {
        const sourcePath = path.join(sourceFilesPath, file);
        const destPath = path.join(shareExtensionPath, file);
        
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`✅ Copied ${file} to Share Extension`);
        } else {
          console.warn(`⚠️ Warning: ${file} not found in native-files/ios/${SHARE_EXTENSION_NAME}/`);
        }
      });
    } else {
      console.warn(`⚠️ Warning: Source files not found at ${sourceFilesPath}`);
    }

    // Copy AppGroupsStorage native module files to ios directory
    console.log('\n📦 Copying AppGroupsStorage native module...');
    const appGroupsFiles = ['AppGroupsStorage.swift', 'AppGroupsStorage.m'];
    
    appGroupsFiles.forEach(file => {
      const sourcePath = path.join(nativeModulesSourcePath, file);
      const destPath = path.join(iosPath, file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ Copied ${file} to ios/`);
      } else {
        console.warn(`⚠️ Warning: ${file} not found in native-files/ios/`);
      }
    });
    
    return config;
  });

  return config;
}

module.exports = withShareExtension;

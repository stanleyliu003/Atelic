#!/usr/bin/env node

/**
 * Script to update the Share Extension's Lambda endpoint URL based on environment.
 * Writes the correct URL into Info.plist so ShareViewController.swift reads it at runtime.
 *
 * Run this after `expo prebuild` or as part of the EAS prebuild pipeline.
 */

const fs = require('fs');
const path = require('path');

const LAMBDA_URLS = {
  staging: 'https://adetk4ycvtm7wkwbzppbleegra0auhxi.lambda-url.us-east-1.on.aws/',
  production: 'https://4waslmaifuc4dt7cwpoekuowwq0wcmql.lambda-url.us-east-1.on.aws/',
};

function getEnvironment() {
  let env =
    process.env.AMPLIFY_ENV ||
    process.env.ATELIC_ENV ||
    process.env.ENVIRONMENT ||
    process.env.STAGE ||
    '';

  // Fall back to Amplify's local config if no env var is set
  if (!env) {
    try {
      const localEnvPath = path.join(__dirname, '../amplify/.config/local-env-info.json');
      const localEnv = JSON.parse(fs.readFileSync(localEnvPath, 'utf8'));
      env = localEnv.envName || '';
    } catch (_) {
      // Config file not found or unreadable — ignore
    }
  }

  return String(env).toLowerCase();
}

function updatePlist(plistPath, lambdaUrl) {
  if (!fs.existsSync(plistPath)) {
    console.log(`ℹ️  ${plistPath} not found — skipping`);
    return false;
  }

  let content = fs.readFileSync(plistPath, 'utf8');

  // Check if LambdaEndpoint key already exists
  if (content.includes('<key>LambdaEndpoint</key>')) {
    // Replace existing value
    content = content.replace(
      /(<key>LambdaEndpoint<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${lambdaUrl}$2`
    );
  } else {
    // Insert before closing </dict></plist>
    content = content.replace(
      /(<\/dict>\s*<\/plist>)/,
      `\t<key>LambdaEndpoint</key>\n\t<string>${lambdaUrl}</string>\n$1`
    );
  }

  fs.writeFileSync(plistPath, content, 'utf8');
  return true;
}

try {
  const env = getEnvironment();
  const isProduction = ['prod', 'production'].includes(env);
  const lambdaUrl = isProduction ? LAMBDA_URLS.production : LAMBDA_URLS.staging;

  console.log(`🔧 Share Extension config — environment: ${env || 'unknown (defaulting to staging)'}`);
  console.log(`🔧 Lambda endpoint: ${lambdaUrl}`);

  // Update both the live ios/ copy and the native-files/ template
  const plistPaths = [
    path.join(__dirname, '../ios/AtelicShareExtension/Info.plist'),
    path.join(__dirname, '../native-files/ios/AtelicShareExtension/Info.plist'),
  ];

  let updated = false;
  for (const plistPath of plistPaths) {
    if (updatePlist(plistPath, lambdaUrl)) {
      console.log(`✅ Updated ${path.relative(path.join(__dirname, '..'), plistPath)}`);
      updated = true;
    }
  }

  if (!updated) {
    console.log('ℹ️  No Info.plist files found to update — skipping');
  }
} catch (error) {
  console.error('❌ Error updating Share Extension config:', error.message);
  process.exit(1);
}

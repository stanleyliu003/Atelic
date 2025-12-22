#!/usr/bin/env node

/**
 * Script to update OAuth domain in aws-exports.js to use custom domain
 * Run this after `amplify pull` or `amplify push`
 */

const fs = require('fs');
const path = require('path');

const AWS_EXPORTS_PATH = path.join(__dirname, '../src/aws-exports.js');

// Environment-specific custom domains
// Only production uses custom domain, dev and staging use default Cognito domains
const CUSTOM_DOMAINS = {
  'atelictravel-prod.auth.us-east-1.amazoncognito.com': 'auth.atelictravel.com',
  'atelictravel-production.auth.us-east-1.amazoncognito.com': 'auth.atelictravel.com',
};

try {
  let content = fs.readFileSync(AWS_EXPORTS_PATH, 'utf8');

  let updated = false;
  for (const [cognitoDomain, customDomain] of Object.entries(CUSTOM_DOMAINS)) {
    if (content.includes(cognitoDomain)) {
      content = content.replace(
        `"domain": "${cognitoDomain}"`,
        `"domain": "${customDomain}"`
      );
      updated = true;
      console.log(`✅ Updated OAuth domain: ${cognitoDomain} → ${customDomain}`);
      break;
    }
  }

  if (updated) {
    fs.writeFileSync(AWS_EXPORTS_PATH, content, 'utf8');
    console.log('✅ aws-exports.js updated successfully');
  } else {
    console.log('ℹ️  No OAuth domain update needed');
  }
} catch (error) {
  console.error('❌ Error updating aws-exports.js:', error.message);
  process.exit(1);
}

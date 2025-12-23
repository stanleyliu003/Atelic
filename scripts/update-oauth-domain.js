#!/usr/bin/env node

/**
 * Script to update OAuth domain in aws-exports.js to use custom domain
 * Run this after `amplify pull` or `amplify push`
 */

const fs = require('fs');
const path = require('path');

const AWS_EXPORTS_PATH = path.join(__dirname, '../src/aws-exports.js');

const PRODUCTION_OAUTH_DOMAIN = 'auth.atelictravel.com';

function isProductionEnvironment() {
  const env =
    process.env.AMPLIFY_ENV ||
    process.env.ATELIC_ENV ||
    process.env.ENVIRONMENT ||
    process.env.STAGE ||
    process.env.NODE_ENV ||
    '';

  return ['prod', 'production'].includes(String(env).toLowerCase());
}

try {
  if (!isProductionEnvironment()) {
    console.log(
      'ℹ️  Not in production environment (set AMPLIFY_ENV=production to enable) — skipping OAuth domain update'
    );
    process.exit(0);
  }

  let content = fs.readFileSync(AWS_EXPORTS_PATH, 'utf8');

  const oauthDomainRegex = /("oauth"\s*:\s*\{[\s\S]*?"domain"\s*:\s*")([^"]*)(")/m;
  const match = content.match(oauthDomainRegex);

  if (!match) {
    console.log('ℹ️  Could not find oauth.domain in aws-exports.js — no update performed');
    process.exit(0);
  }

  const currentDomain = match[2];
  if (currentDomain === PRODUCTION_OAUTH_DOMAIN) {
    console.log(`ℹ️  OAuth domain already set to ${PRODUCTION_OAUTH_DOMAIN}`);
    process.exit(0);
  }

  content = content.replace(oauthDomainRegex, `$1${PRODUCTION_OAUTH_DOMAIN}$3`);
  console.log(`✅ Updated OAuth domain: ${currentDomain} → ${PRODUCTION_OAUTH_DOMAIN}`);

  fs.writeFileSync(AWS_EXPORTS_PATH, content, 'utf8');
  console.log('✅ aws-exports.js updated successfully');
} catch (error) {
  console.error('❌ Error updating aws-exports.js:', error.message);
  process.exit(1);
}

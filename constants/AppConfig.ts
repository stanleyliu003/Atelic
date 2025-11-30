/**
 * App Configuration Constants
 * Central location for app-wide configuration including version management
 */

import awsconfig from '../src/aws-exports';

/**
 * Detect current Amplify environment based on GraphQL endpoint
 */
const getCurrentEnv = (): 'dev' | 'staging' | 'prod' => {
  const endpoint = awsconfig.aws_appsync_graphqlEndpoint || '';
  if (endpoint.includes('dev')) return 'dev';
  if (endpoint.includes('staging')) return 'staging';
  return 'prod';
};

/**
 * Minimum supported app versions by environment
 * - Dev: No restrictions (allows testing with any version)
 * - Staging: Enforces V1.0.2 to test update flow
 * - Prod: Enforces V1.0.2 after backend deployment
 */
const MINIMUM_VERSIONS_BY_ENV = {
  dev: { ios: '1.0.0', android: '1.0.0' },     // No restrictions in dev
  staging: { ios: '1.0.3', android: '1.0.3' }, // Test update flow
  prod: { ios: '1.0.3', android: '1.0.3' },    // Enforce in production
};

/**
 * Current environment's minimum version requirements
 */
export const MINIMUM_APP_VERSION = MINIMUM_VERSIONS_BY_ENV[getCurrentEnv()];

/**
 * App Store URLs for directing users to update
 */
export const APP_STORE_URLS = {
  ios: 'https://apps.apple.com/us/app/atelic-travel-planner/id6748835773',
  android: 'https://play.google.com/store/apps/details?id=com.atelic.app', // TODO: Update with actual Android package ID
};

/**
 * Current environment (exported for debugging/logging purposes)
 */
export const CURRENT_ENV = getCurrentEnv();

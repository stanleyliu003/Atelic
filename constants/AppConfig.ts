/**
 * App Configuration Constants
 * Central location for app-wide configuration
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
 * Current environment (used by version check service and other features)
 */
export const CURRENT_ENV = getCurrentEnv();

/**
 * App Store URLs for directing users to update
 */
export const APP_STORE_URLS = {
  ios: 'https://apps.apple.com/us/app/atelic-travel-planner/id6748835773',
  android: 'https://play.google.com/store/apps/details?id=com.atelic.app', // TODO: Update with actual Android package ID
};

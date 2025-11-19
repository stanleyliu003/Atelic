/**
 * Verify app.json version is correctly set
 */

const appJson = require('./app.json');

console.log('📱 App Version Check\n');
console.log('app.json version:', appJson.expo.version);
console.log('Expected:', '1.0.2');
console.log('Match:', appJson.expo.version === '1.0.2' ? '✅ YES' : '❌ NO');

if (appJson.expo.version === '1.0.2') {
  console.log('\n✅ app.json is correctly set to 1.0.2');
  console.log('DeviceInfo.getVersion() will return: 1.0.2');
  console.log('Version check will: PASS (allow app to continue)');
} else {
  console.log('\n⚠️  app.json is NOT set to 1.0.2');
  console.log(`Current version: ${appJson.expo.version}`);
  console.log('You need to update app.json');
}

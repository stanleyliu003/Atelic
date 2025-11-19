/**
 * Test script for version comparison logic
 * Run with: node test_version_check.js
 */

// Simple version of the comparison function for testing
const isVersionOutdated = (current, minimum) => {
  if (!current) {
    console.log('⚠️  Version is null/undefined - failing open (allowing access)');
    return false;
  }

  try {
    const currentParts = current.split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const currentNum = currentParts[i] || 0;
      const minimumNum = minimumParts[i] || 0;

      if (currentNum < minimumNum) {
        return true;
      }
      if (currentNum > minimumNum) {
        return false;
      }
    }

    return false;
  } catch (error) {
    console.error('Error comparing versions:', error);
    return false;
  }
};

// Test cases
const tests = [
  { current: '1.0.0', minimum: '1.0.2', expected: true, description: 'V1.0.0 should require update' },
  { current: '1.0.1', minimum: '1.0.2', expected: true, description: 'V1.0.1 should require update' },
  { current: '1.0.2', minimum: '1.0.2', expected: false, description: 'V1.0.2 should be OK (equal)' },
  { current: '1.0.3', minimum: '1.0.2', expected: false, description: 'V1.0.3 should be OK (newer patch)' },
  { current: '1.1.0', minimum: '1.0.2', expected: false, description: 'V1.1.0 should be OK (newer minor)' },
  { current: '2.0.0', minimum: '1.0.2', expected: false, description: 'V2.0.0 should be OK (newer major)' },
  { current: null, minimum: '1.0.2', expected: false, description: 'Null version should fail open' },
];

console.log('🧪 Running Version Comparison Tests\n');
console.log('Minimum Required Version: 1.0.2\n');

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  const result = isVersionOutdated(test.current, test.minimum);
  const status = result === test.expected ? '✅ PASS' : '❌ FAIL';

  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(`Test ${index + 1}: ${status}`);
  console.log(`  Current: ${test.current || 'null'}`);
  console.log(`  Minimum: ${test.minimum}`);
  console.log(`  Expected outdated: ${test.expected}, Got: ${result}`);
  console.log(`  ${test.description}`);
  console.log();
});

console.log('═══════════════════════════════════');
console.log(`Total: ${tests.length} tests`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('═══════════════════════════════════');

if (failed === 0) {
  console.log('\n🎉 All tests passed! Version comparison logic is working correctly.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the logic.\n');
  process.exit(1);
}

/**
 * Version Comparison Utilities
 * Handles semantic version comparison for app update enforcement
 */

/**
 * Compares two semantic version strings (e.g., "1.0.2" vs "1.0.1")
 *
 * @param current - Current app version from DeviceInfo
 * @param minimum - Minimum required version from AppConfig
 * @returns true if current version is older than minimum (update required)
 *
 * @example
 * isVersionOutdated('1.0.1', '1.0.2') // true - update required
 * isVersionOutdated('1.0.2', '1.0.2') // false - equal, OK
 * isVersionOutdated('1.0.3', '1.0.2') // false - newer, OK
 * isVersionOutdated('1.1.0', '1.0.2') // false - newer, OK
 * isVersionOutdated(null, '1.0.2')    // false - fail open, don't block
 */
export const isVersionOutdated = (
  current: string | null,
  minimum: string
): boolean => {
  // If version cannot be determined, fail open (don't block users)
  if (!current) {
    console.warn('Unable to determine app version, allowing access');
    return false;
  }

  try {
    const currentParts = current.split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);

    // Compare major.minor.patch
    for (let i = 0; i < 3; i++) {
      const currentNum = currentParts[i] || 0;
      const minimumNum = minimumParts[i] || 0;

      if (currentNum < minimumNum) {
        console.log(`Version outdated: ${current} < ${minimum}`);
        return true;  // Current is older - update required
      }
      if (currentNum > minimumNum) {
        console.log(`Version OK: ${current} > ${minimum}`);
        return false; // Current is newer - OK
      }
      // If equal, continue to next part
    }

    // All parts equal - version is OK
    console.log(`Version OK: ${current} = ${minimum}`);
    return false;
  } catch (error) {
    console.error('Error comparing versions:', error);
    // On error, fail open (don't block users)
    return false;
  }
};

/**
 * Get a human-readable comparison message
 *
 * @param current - Current app version
 * @param minimum - Minimum required version
 * @returns Description of version status
 */
export const getVersionStatus = (
  current: string | null,
  minimum: string
): string => {
  if (!current) return 'Unknown version';
  if (isVersionOutdated(current, minimum)) return `Outdated (${current} < ${minimum})`;
  return `Up to date (${current})`;
};

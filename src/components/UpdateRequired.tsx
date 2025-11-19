/**
 * UpdateRequired Component
 * Full-screen blocking modal that prevents app usage until user updates
 * Displayed when app version is older than minimum required version
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { APP_STORE_URLS } from '../../constants/AppConfig';

interface UpdateRequiredProps {
  currentVersion: string;
  minimumVersion: string;
}

export const UpdateRequired: React.FC<UpdateRequiredProps> = ({
  currentVersion,
  minimumVersion,
}) => {
  const handleUpdatePress = () => {
    const storeUrl = Platform.OS === 'ios'
      ? APP_STORE_URLS.ios
      : APP_STORE_URLS.android;

    Linking.openURL(storeUrl).catch(err =>
      console.error('Failed to open app store:', err)
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>📱</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Update Required</Text>

        {/* Message */}
        <Text style={styles.message}>
          A new version of Atelic is required to continue.
          Please update to the latest version from the App Store.
        </Text>

        {/* Version Info */}
        <View style={styles.versionInfo}>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Current Version</Text>
            <Text style={styles.versionValue}>{currentVersion}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Required Version</Text>
            <Text style={styles.versionValueRequired}>{minimumVersion}</Text>
          </View>
        </View>

        {/* Update Button */}
        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdatePress}
          activeOpacity={0.8}
        >
          <Text style={styles.updateButtonText}>Update Now</Text>
        </TouchableOpacity>

        {/* Helper Text */}
        <Text style={styles.helperText}>
          You'll be redirected to the App Store
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  versionInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: 16,
  },
  versionLabel: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
  },
  versionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  versionValueRequired: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F36406',
  },
  updateButton: {
    backgroundColor: '#F36406',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    color: '#ADB5BD',
    marginTop: 16,
    textAlign: 'center',
  },
});

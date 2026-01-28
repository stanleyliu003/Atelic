import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UnsplashAttribution } from '../../types/unsplash.types';

interface UnsplashAttributionModalProps {
  visible: boolean;
  attribution: UnsplashAttribution;
  onClose: () => void;
}

/**
 * Modal displaying Unsplash photo attribution
 *
 * Shows photographer name and Unsplash credit with clickable links.
 * Includes UTM parameters as required by Unsplash API guidelines.
 */
export default function UnsplashAttributionModal({
  visible,
  attribution,
  onClose,
}: UnsplashAttributionModalProps) {
  // Build UTM parameters for Unsplash compliance
  const UTM_PARAMS = '?utm_source=atelic&utm_medium=referral';

  const handlePhotographerPress = async () => {
    const url = `${attribution.photographerProfileUrl}${UTM_PARAMS}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('[Unsplash] Failed to open photographer URL:', error);
    }
  };

  const handleUnsplashPress = async () => {
    const url = `https://unsplash.com${UTM_PARAMS}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('[Unsplash] Failed to open Unsplash URL:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.modalContainer}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              {/* Close button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>

              {/* Title */}
              <Text style={styles.title}>Photo Attribution</Text>

              {/* Attribution text with links */}
              <View style={styles.attributionContainer}>
                <Text style={styles.attributionText}>Photo by </Text>
                <TouchableOpacity onPress={handlePhotographerPress}>
                  <Text style={styles.link}>
                    {attribution.photographerName}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.attributionText}> on </Text>
                <TouchableOpacity onPress={handleUnsplashPress}>
                  <Text style={styles.link}>Unsplash</Text>
                </TouchableOpacity>
              </View>

              {/* Info text */}
              <Text style={styles.infoText}>
                This photo is provided by Unsplash's free API
              </Text>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'outfit-bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  attributionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  attributionText: {
    fontSize: 15,
    fontFamily: 'outfit',
    color: '#374151',
  },
  link: {
    fontSize: 15,
    fontFamily: 'outfit-semibold',
    color: '#F36406',
    textDecorationLine: 'underline',
  },
  infoText: {
    fontSize: 12,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});

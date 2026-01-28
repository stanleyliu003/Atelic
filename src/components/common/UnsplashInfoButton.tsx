import React, { useState } from 'react';
import { Pressable, StyleSheet, View, Text, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UnsplashAttribution } from '../../types/unsplash.types';

interface UnsplashInfoButtonProps {
  attribution: UnsplashAttribution;
}

/**
 * Info button overlay for Unsplash images
 *
 * Displays an info button that toggles attribution overlay.
 * Clicking the overlay opens the photographer's profile.
 * Required for Unsplash API compliance.
 */
export default function UnsplashInfoButton({ attribution }: UnsplashInfoButtonProps) {
  const [showAttribution, setShowAttribution] = useState(false);

  const handleInfoPress = () => {
    setShowAttribution(!showAttribution);
  };

  const handleAttributionPress = async () => {
    const UTM_PARAMS = '?utm_source=atelic&utm_medium=referral';
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

  const handleInfoPressWithStop = (e: any) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    handleInfoPress();
  };

  const handleAttributionPressWithStop = async (e: any) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    await handleAttributionPress();
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Info Button - Always Visible */}
      <View
        style={styles.buttonWrapper}
        onStartShouldSetResponder={() => true}
        onResponderRelease={handleInfoPressWithStop}
      >
        <Pressable
          style={({ pressed }) => [
            styles.infoButton,
            pressed && styles.infoButtonPressed,
          ]}
          onPress={handleInfoPressWithStop}
          accessibilityLabel="Toggle photo attribution"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={showAttribution ? "close-circle" : "information-circle"}
            size={16}
            color="rgba(255, 255, 255, 0.9)"
          />
        </Pressable>
      </View>

      {/* Attribution Overlay - Shown When Info Button Clicked */}
      {showAttribution && (
        <View
          style={styles.overlayWrapper}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleAttributionPressWithStop}
        >
          <Pressable
            style={styles.attributionOverlay}
            onPress={handleAttributionPressWithStop}
            accessibilityLabel={`Photo by ${attribution.photographerName}. Tap to view photographer profile.`}
            accessibilityRole="button"
          >
            <View style={styles.attributionContent}>
              <Text style={styles.photographerLine} numberOfLines={1}>
                <Text style={styles.labelText}>Photo by </Text>
                <Text style={styles.highlightText}>{attribution.photographerName}</Text>
              </Text>
              <Text style={styles.unsplashText}>
                <Text style={styles.onText}>on </Text>
                <Text style={styles.unsplashBold}>Unsplash</Text>
              </Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  buttonWrapper: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 9999,
  },
  overlayWrapper: {
    position: 'absolute',
    top: 8,
    left: 38,
    zIndex: 9998,
  },
  infoButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 11,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 1,
  },
  infoButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    transform: [{ scale: 0.90 }],
  },
  attributionOverlay: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  attributionContent: {
    alignItems: 'flex-start',
    gap: 0.5,
  },
  photographerLine: {
    fontSize: 9,
    fontFamily: 'outfit',
    textAlign: 'left',
  },
  labelText: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'outfit',
  },
  highlightText: {
    fontSize: 9,
    fontFamily: 'outfit-bold',
    color: '#FFFFFF',
  },
  unsplashText: {
    fontSize: 9,
    fontFamily: 'outfit',
    textAlign: 'left',
  },
  onText: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'outfit',
  },
  unsplashBold: {
    fontSize: 9,
    fontFamily: 'outfit-bold',
    color: '#FFFFFF',
  },
});

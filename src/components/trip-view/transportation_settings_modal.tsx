import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Pressable,
  ActionSheetIOS,
  Platform,
  PanResponder,
  Animated,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { TravelMode, RouteLegModeData, Activity } from '../../types/activity.types';
import { Colors } from '../../../constants/Colors';
import { formatDistance, formatDuration } from '../../utils/routeUtils';

interface TransportationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMode: (mode: TravelMode) => void;
  currentMode: TravelMode;
  modeData: {
    DRIVE?: RouteLegModeData;
    WALK?: RouteLegModeData;
    TRANSIT?: RouteLegModeData;
  };
  loadingModes: TravelMode[];
  originActivity?: Activity;
  destinationActivity?: Activity;
}

const TransportationSettingsModal: React.FC<TransportationSettingsModalProps> = ({
  visible,
  onClose,
  onSelectMode,
  currentMode,
  modeData,
  loadingModes,
  originActivity,
  destinationActivity,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to significant downward swipes
        return Math.abs(gestureState.dy) > 5 && gestureState.dy > 0;
      },
      onPanResponderGrant: () => {
        // Set initial value when gesture starts
        translateY.setOffset(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward movement
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();

        // Close modal if swiped down more than 80 pixels or with velocity
        const shouldClose = gestureState.dy > 80 || gestureState.vy > 0.5;

        if (shouldClose) {
          // Reset position and close immediately - let Modal's native animation handle the smooth close
          translateY.setValue(0);
          onClose();
        } else {
          // Snap back to original position
          Animated.spring(translateY, {
            toValue: 0,
            tension: 120,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const modes: { key: TravelMode; label: string; icon: JSX.Element }[] = [
    {
      key: 'WALK',
      label: 'Walking',
      icon: <MaterialIcons name="directions-walk" size={28} color="#333" />,
    },
    {
      key: 'DRIVE',
      label: 'Car',
      icon: <MaterialCommunityIcons name="car" size={28} color="#333" />,
    },
    {
      key: 'TRANSIT',
      label: 'Public Transport',
      icon: <MaterialCommunityIcons name="bus" size={28} color="#333" />,
    },
  ];

  // Helper function to convert our travel modes to Google Maps travel modes
  const getGoogleMapsTravelMode = (travelMode: TravelMode): string => {
    switch (travelMode) {
      case 'DRIVE':
        return 'driving';
      case 'TRANSIT':
        return 'transit';
      case 'WALK':
        return 'walking';
      default:
        return 'driving';
    }
  };

  const handleSelectMode = (mode: TravelMode) => {
    // Update the selected mode and close modal automatically
    onSelectMode(mode);
    onClose();
  };

  const openGoogleMaps = async (mode: TravelMode) => {
    try {
      if (!originActivity || !destinationActivity) {
        console.error('[Modal] Missing origin or destination');
        return;
      }

      if (!originActivity.lat || !originActivity.lng || !destinationActivity.lat || !destinationActivity.lng) {
        console.error('[Modal] Missing coordinates');
        return;
      }

      // Use place names for better display, with coordinates as fallback
      const originName = encodeURIComponent(originActivity.name || `${originActivity.lat},${originActivity.lng}`);
      const destinationName = encodeURIComponent(destinationActivity.name || `${destinationActivity.lat},${destinationActivity.lng}`);
      const googleMapsTravelMode = getGoogleMapsTravelMode(mode);

      // Try Google Maps app first
      const googleMapsAppUrl = `comgooglemaps://?saddr=${originName}&daddr=${destinationName}&directionsmode=${googleMapsTravelMode}`;
      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsAppUrl);

      if (canOpenGoogleMaps) {
        await Linking.openURL(googleMapsAppUrl);
        console.log('[Modal] Opened Google Maps app');
        onClose();
      } else {
        // Fallback to Google Maps web - use place_id if available for accuracy
        let webUrl;
        if (originActivity.place_id && destinationActivity.place_id) {
          webUrl = `https://www.google.com/maps/dir/?api=1&origin=${originName}&origin_place_id=${originActivity.place_id}&destination=${destinationName}&destination_place_id=${destinationActivity.place_id}&travelmode=${googleMapsTravelMode}`;
        } else {
          webUrl = `https://www.google.com/maps/dir/?api=1&origin=${originName}&destination=${destinationName}&travelmode=${googleMapsTravelMode}`;
        }
        await Linking.openURL(webUrl);
        console.log('[Modal] Opened Google Maps web');
        onClose();
      }
    } catch (error) {
      console.error('[Modal] Error opening Google Maps:', error);
    }
  };

  const openAppleMaps = async (mode: TravelMode) => {
    try {
      if (!originActivity || !destinationActivity) {
        console.error('[Modal] Missing origin or destination');
        return;
      }

      if (!originActivity.lat || !originActivity.lng || !destinationActivity.lat || !destinationActivity.lng) {
        console.error('[Modal] Missing coordinates');
        return;
      }

      // Use place names for better display
      const originName = encodeURIComponent(originActivity.name || `${originActivity.lat},${originActivity.lng}`);
      const destinationName = encodeURIComponent(destinationActivity.name || `${destinationActivity.lat},${destinationActivity.lng}`);

      // Convert travel mode to direction flag: d=driving, w=walking, r=transit
      const directionFlag = mode === 'DRIVE' ? 'd' : mode === 'WALK' ? 'w' : 'r';
      const appleMapsUrl = `maps://?saddr=${originName}&daddr=${destinationName}&dirflg=${directionFlag}`;

      await Linking.openURL(appleMapsUrl);
      console.log('[Modal] Opened Apple Maps');
      onClose();
    } catch (error) {
      console.error('[Modal] Error opening Apple Maps:', error);
    }
  };

  const handleOpenMaps = (mode: TravelMode) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Google Maps', 'Apple Maps'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // Google Maps
            openGoogleMaps(mode);
          } else if (buttonIndex === 2) {
            // Apple Maps
            openAppleMaps(mode);
          }
        }
      );
    } else {
      // Default to Google Maps on Android
      openGoogleMaps(mode);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY }],
            },
          ]}
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
        >
          {/* Drag handle indicator */}
          <View
            style={styles.dragHandle}
            {...panResponder.panHandlers}
          >
            <View style={styles.dragHandleLine} />
          </View>
          {/* Origin/Destination Header */}
          {originActivity && destinationActivity && (
            <View style={styles.routeHeader}>
              <View style={styles.routeInfoContainer}>
                <View style={styles.routeIconsColumn}>
                  <View style={styles.originDot} />
                  <View style={styles.routeLine} />
                  <MaterialIcons name="place" size={18} color="#FF3B30" />
                </View>
                <View style={styles.routeTextColumn}>
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>From</Text>
                    <Text style={styles.locationText} numberOfLines={1}>
                      {originActivity.name}
                    </Text>
                  </View>
                  <View style={[styles.locationTextContainer, styles.destinationContainer]}>
                    <Text style={styles.locationLabel}>To</Text>
                    <Text style={styles.locationText} numberOfLines={1}>
                      {destinationActivity.name}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Transportation</Text>
            <Text style={styles.timestamp}>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {/* Mode Options */}
          <View style={styles.optionsContainer}>
            {modes.map((mode) => {
              const data = modeData[mode.key];
              const isLoading = loadingModes.includes(mode.key);
              const isSelected = currentMode === mode.key;
              const isAvailable = !!data || isLoading;

              return (
                <View
                  key={mode.key}
                  style={[
                    styles.modeOption,
                    isSelected && styles.modeOptionSelected,
                    !isAvailable && styles.modeOptionDisabled,
                  ]}
                >
                  {/* Main content - tap to select mode */}
                  <TouchableOpacity
                    style={styles.modeContent}
                    onPress={() => isAvailable && handleSelectMode(mode.key)}
                    disabled={!isAvailable}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modeIcon}>{mode.icon}</View>

                    <View style={styles.modeDetails}>
                      <Text style={styles.modeLabel}>
                        {mode.label}
                      </Text>

                      {isLoading ? (
                        <ActivityIndicator size="small" color="#999" />
                      ) : data ? (
                        <Text style={styles.modeStats}>
                          {formatDistance(data.distance)} | {formatDuration(data.duration)}
                        </Text>
                      ) : (
                        <Text style={styles.unavailableText}>Not available</Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Directions button - only show on selected mode, opens map selection */}
                  {isSelected && isAvailable && (
                    <TouchableOpacity
                      style={styles.directionsButton}
                      onPress={() => handleOpenMaps(mode.key)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name="directions"
                        size={24}
                        color="white"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  routeHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  routeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  routeIconsColumn: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 12,
    paddingVertical: 2,
  },
  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333333',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#333333',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#D1D1D6',
    marginVertical: 4,
  },
  routeTextColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  locationTextContainer: {
    marginBottom: 6,
  },
  destinationContainer: {
    marginBottom: 0,
    marginTop: 6,
  },
  locationLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 15,
    color: '#1C1C1E',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.4,
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modeOptionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#333333',
    borderWidth: 2,
    shadowColor: '#333333',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  modeOptionDisabled: {
    opacity: 0.4,
  },
  modeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  modeDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  modeStats: {
    fontSize: 13,
    color: '#636366',
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  unavailableText: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  directionsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  dragHandleLine: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D1D6',
    borderRadius: 2,
  },
});

export default TransportationSettingsModal;

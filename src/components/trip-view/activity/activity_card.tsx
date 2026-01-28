import { Colors } from '../../../../constants/Colors';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Activity } from '../../../types/activity.types';
import { formatDistance, formatDuration } from '../../../utils/routeUtils';
import { ActivityImage } from './activity_image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AddNotesModal } from './add_notes_modal';

// Helper function to convert 24-hour time to 12-hour format with AM/PM
const format12Hour = (time24?: string): string => {
  if (!time24) return '';
  const [hourStr, minute] = time24.split(':');
  const hour24 = parseInt(hourStr, 10);
  const isPM = hour24 >= 12;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return `${hour12}:${minute} ${isPM ? 'PM' : 'AM'}`;
};


interface ActivityCardProps {
  activity: Activity;
  style?: any;
  isSelected?: boolean;
  onPress?: (activity: Activity) => void;
  onLongPress?: (activity: Activity) => void;
  onDescriptionCardPress?: (activity: Activity) => void; // New prop for card content selection
  showSelectionIndicator?: boolean;
  disabled?: boolean;
  index?: number; // New prop for displaying numbered prefix
  nextActivityDistance?: number; // Distance to next activity in meters
  nextActivityDuration?: string; // Duration to next activity
  isLastActivity?: boolean; // Whether this is the last activity in the list
  nextActivity?: Activity; // Next activity for Google Maps routing
  travelMode?: string; // Travel mode from route calculation (DRIVE, TRANSIT, WALK)
  hideRouteInfo?: boolean; // New prop to hide route info during drag operations
  duplicateActivityIndicator?: boolean; // New prop to indicate activities already in wishlist
  enableDragDrop?: boolean; // New prop to enable drag & drop functionality
  useInlineSelectionLayout?: boolean; // Use inline layout for wishlist (not absolute positioned)
  activeTab?: string; // Current active tab (wishlist or day#)
  hideNotesButton?: boolean; // Hide the notes button (e.g., in CategoryModal)
  currentUserRole?: 'owner' | 'editor' | 'viewer'; // User's role for permission control
}

// Helper function to convert our travel modes to Google Maps travel modes
const getGoogleMapsTravelMode = (travelMode?: string): string => {
  switch (travelMode) {
    case 'DRIVE':
      return 'driving';
    case 'TRANSIT':
      return 'transit';
    case 'WALK':
      return 'walking';
    default:
      return 'driving'; // Default fallback
  }
};

// Helper function to get the appropriate icon based on travel mode
const getTravelModeIcon = (travelMode?: string) => {
  switch (travelMode) {
    case 'WALK':
      return <MaterialIcons name="directions-walk" size={17} color={Colors.PRIMARY} />;
    case 'TRANSIT':
      return <MaterialIcons name="directions-transit" size={17} color={Colors.PRIMARY} />;
    case 'DRIVE':
    default:
      return <MaterialCommunityIcons name="car-outline" size={17} color={Colors.PRIMARY} />;
  }
};

export function ActivityCard({
  activity,
  style,
  isSelected = false,
  onPress,
  onLongPress,
  onDescriptionCardPress,
  showSelectionIndicator = false,
  disabled = false,
  index,
  nextActivityDistance,
  nextActivityDuration,
  isLastActivity = false,
  nextActivity,
  travelMode,
  hideRouteInfo = false,
  duplicateActivityIndicator = false,
  enableDragDrop = false,
  useInlineSelectionLayout = false,
  activeTab,
  hideNotesButton = false,
  currentUserRole
}: ActivityCardProps) {
  const [notesModalVisible, setNotesModalVisible] = useState(false);

  const handlePress = () => {
    if (!disabled && onPress) {
      onPress(activity);
    }
  };

  const handleLongPress = () => {
    if (!disabled && onLongPress) {
      onLongPress(activity);
    }
  };

  const handleDescriptionCardPress = () => {
    if (!disabled && onDescriptionCardPress) {
      onDescriptionCardPress(activity);
    }
  };

  const handleRoutePress = () => {
    if (!nextActivity) return;

    const googleMapsTravelMode = getGoogleMapsTravelMode(travelMode);

    const createCoordinateUrl = () => {
      if (activity.lat && activity.lng && nextActivity.lat && nextActivity.lng) {
        const origin = `${activity.lat},${activity.lng}`;
        const destination = `${nextActivity.lat},${nextActivity.lng}`;
        return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${googleMapsTravelMode}`;
      }
      return null;
    };

    if (activity.name && nextActivity.name) {
      // Use activity names for better user experience
      const origin = encodeURIComponent(activity.name);
      const destination = encodeURIComponent(nextActivity.name);
      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${googleMapsTravelMode}`;

      Linking.openURL(url).catch(err => {
        console.error('Error opening Google Maps:', err);
        // Fallback to coordinates if name-based URL fails
        const fallbackUrl = createCoordinateUrl();
        if (fallbackUrl) {
          Linking.openURL(fallbackUrl);
        }
      });
    } else {
      // Use coordinates if names aren't available
      const url = createCoordinateUrl();
      if (url) {
        Linking.openURL(url).catch(err => {
          console.error('Error opening Google Maps:', err);
        });
      }
    }
  };

  // Format the activity name with optional number prefix (hotels don't get numbers)
  const isHotel = activity.isLodging === true || activity.primaryType === 'lodging';
  const getDisplayName = () => {
    if (index !== undefined && index >= 0 && !isHotel) {
      return `${index + 1}. ${activity.name}`;
    }
    return activity.name;
  };

  // Helper to determine if activity has notes or times
  const hasNotes = !!(activity.notes || activity.startTime || activity.endTime);

  // Get the button text based on whether times are set
  const getNotesButtonText = () => {
    if (activity.startTime && activity.endTime) {
      return `${format12Hour(activity.startTime)} - ${format12Hour(activity.endTime)}`;
    }
    return 'Add Notes';
  };

  return (
    <View style={styles.cardContainer}>
      <View
        style={[
          styles.activityCard,
          style,
          (isSelected || duplicateActivityIndicator) && styles.selectedCard,
          disabled && styles.disabledCard
        ]}
      >
        <View style={styles.activityContent}>
          {showSelectionIndicator && (
            <View style={useInlineSelectionLayout ? styles.selectionContainerInline : styles.selectionAndGripContainer}>
              <View style={useInlineSelectionLayout ? styles.selectionIndicatorWrapper : styles.selectionContainer}>
                <View style={[
                  styles.selectionIndicator,
                  (isSelected || duplicateActivityIndicator) && styles.selectedIndicator
                ]}>
                  {(isSelected || duplicateActivityIndicator) && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <TouchableOpacity
                  style={styles.selectionTouchArea}
                  onPress={handlePress}
                  disabled={disabled || duplicateActivityIndicator}
                  activeOpacity={1}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.cardContentArea, useInlineSelectionLayout && styles.cardContentAreaInline]}
            onPress={onDescriptionCardPress ? handleDescriptionCardPress : (!showSelectionIndicator ? handlePress : undefined)}
            onLongPress={handleLongPress}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <View style={styles.activityInfo}>
              <Text
                style={[styles.activityText, disabled && styles.disabledText]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {getDisplayName()}
              </Text>
              <View style={styles.activityStats}>
                {activity.rating && (
                  <View style={styles.ratingContainer}>
                    <Text style={[styles.ratingText, disabled && styles.disabledText]}>
                      {activity.rating} <FontAwesome name="star" size={16} color="#FABC05" />
                    </Text>
                  </View>
                )}
                {activity.primary_type_display_name && (
                  <View style={styles.typesContainer}>
                    <Text
                      style={[styles.typesText, disabled && styles.disabledText]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {activity.primary_type_display_name}
                    </Text>
                  </View>
                )}
                {/*
                {duplicateActivityIndicator && (
                  <View style={styles.onListContainer}>
                    <Text style={styles.onListText}>On list</Text>
                  </View>
                )}
                  */}
              </View>

              {/* Add Notes/Time Section - Always on a new line - Hide in CategoryModal */}
              {!hideNotesButton && (
                <TouchableOpacity
                  style={styles.notesSection}
                  onPress={() => setNotesModalVisible(true)}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  {hasNotes ? (
                    <View style={styles.notesContentContainer}>
                      {/* Time Section with clock icon */}
                      {(activity.startTime && activity.endTime) && (
                        <View style={styles.timeRow}>
                          <Text style={styles.timeText}>
                            {getNotesButtonText()}
                          </Text>
                          <MaterialIcons name="access-time" size={16} color="#60A5FA" style={styles.clockIcon} />
                        </View>
                      )}
                      {/* Notes Section */}
                      {activity.notes && (
                        <Text style={styles.notesText} numberOfLines={1}>
                          {activity.notes}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.addNotesButton}>
                      <MaterialIcons name="edit" size={14} color="#94A3B8" />
                      <Text style={styles.addNotesText}>Add Notes</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <ActivityImage
              photo_reference={activity.photo_reference || ''}
              place_id={activity.place_id}
              style={[styles.activityImage, disabled && styles.disabledImage]}
              activityName={activity.name}
              primaryType={activity.primaryType}
              types={activity.types}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Distance and Travel Time Info - Always visible to prevent disappearing during reorder */}
      {!hideRouteInfo && !isLastActivity && (
        <TouchableOpacity
          style={styles.routeInfo}
          onPress={handleRoutePress}
          activeOpacity={0.7}
        >
          {nextActivityDistance !== undefined && nextActivityDistance !== null && nextActivityDistance > 0 && nextActivityDuration ? (
            <>
              <View style={styles.routeInfoItem}>
                {getTravelModeIcon(travelMode)}
                <Text style={styles.routeInfoValue}>  {formatDuration(nextActivityDuration)}</Text>
              </View>
              <View style={styles.routeInfoItem}>
                <Text style={styles.routeMidDotLabel}>· </Text>
                <Text style={styles.routeInfoValue}>{formatDistance(nextActivityDistance)}</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={18} color={Colors.PRIMARY} style={styles.chevronIcon} />
            </>
          ) : (
            <Text style={styles.loadingText}>Loading...</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Add Notes Modal */}
      <AddNotesModal
        visible={notesModalVisible}
        onClose={() => setNotesModalVisible(false)}
        activity={activity}
        activeTab={activeTab}
        currentUserRole={currentUserRole}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 5,
    marginHorizontal: 2, // Add horizontal margin to show shadow borders
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2, // Reduced from 10 to 5 (saves 10px total: 5px on each side)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedCard: {
    backgroundColor: '#f0f8ff',
    //borderWidth: 1,
    borderColor: Colors.PRIMARY,
  },
  disabledCard: {
    opacity: 0.6,
  },
  activityContent: {
    flexDirection: 'row',
    padding: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContentArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 40,
  },
  cardContentAreaInline: {
    paddingLeft: 0, // Remove padding for inline layout
  },
  selectionAndGripContainer: {
    position: 'absolute',
    left: -10,
    top: 10,
    bottom: 10,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  selectionContainerInline: {
    // Inline layout for wishlist (original behavior)
    marginRight: 12,
  },
  selectionContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectionIndicatorWrapper: {
    width: 24,
    height: 24,
    marginRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectionTouchArea: {
    position: 'absolute',
    width: 70,
    height: 70,
    top: -23, // Center the 70px touch area around the 24px indicator (70-24)/2 = 23
    left: -23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderColor: Colors.GRAY,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  selectedIndicator: {
    backgroundColor: Colors.PRIMARY,
    borderWidth: 1,
    borderColor: Colors.PRIMARY,
  },
  checkmark: {
    color: 'white',
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  activityInfo: {
    flex: 1,
    marginRight: 10,
  },
  activityText: {
    color: Colors.PRIMARY,
    fontFamily: 'outfit-medium',
    fontSize: 18,
    marginBottom: 8,
  },
  disabledText: {
    color: Colors.GRAY,
  },
  activityStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  ratingText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
  },
  typesContainer: {
    borderRadius: 10,
    paddingHorizontal: 0,
    flex: 1,
    minWidth: 0,
  },
  typesText: {
    fontFamily: 'outfit',
    fontSize: 13.5,
    color: Colors.GRAY,
    textTransform: 'capitalize',
  },
  onListContainer: {
    backgroundColor: '#06b6d4',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  onListText: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: Colors.WHITE,
    textTransform: 'capitalize',
  },
  activityImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  disabledImage: {
    opacity: 0.6,
  },
  routeInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 3.5,
    marginTop: 0,
    marginBottom: 27,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 9,
  },
  routeInfoLabel: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: Colors.GRAY,
    marginRight: 2,
  },
  routeMidDotLabel: {
    fontFamily: 'outfit',
    fontSize: 24,
    color: Colors.PRIMARY,
    marginLeft: -2,
  },
  routeInfoValue: {
    fontFamily: 'outfit-medium',
    fontSize: 13,
    color: Colors.PRIMARY,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  loadingText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.GRAY,
  },
  notesSection: {
    marginTop: 8,
    marginRight: 10,
  },
  notesContentContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 1,
    alignSelf: 'flex-start',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontFamily: 'outfit-medium',
    fontSize: 13,
    color: '#60A5FA',
    fontWeight: '600',
  },
  clockIcon: {
    marginTop: 1,
  },
  notesText: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  addNotesButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  addNotesText: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#94A3B8',
  },
});
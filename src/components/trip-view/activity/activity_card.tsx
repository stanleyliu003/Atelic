import { Colors } from '../../../../constants/Colors';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Activity } from '../../../types/activity.types';
import { formatDistance, formatDuration } from '../../../utils/routeUtils';
import { ActivityImage } from './activity_image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AddNotesModal } from './add_notes_modal';
import { useCreateTrip } from '../../../../context/CreateTripContext';

// Helper function to convert 24-hour time to 12-hour format with AM/PM
const format12Hour = (time24?: string): string => {
  if (!time24) return '';
  const [hourStr, minute] = time24.split(':');
  const hour24 = parseInt(hourStr, 10);
  const isPM = hour24 >= 12;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return `${hour12}:${minute} ${isPM ? 'PM' : 'AM'}`;
};

// Helper to calculate nights between two ISO date strings
const calculateNights = (checkIn?: string, checkOut?: string): number => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

// Helper to format ISO date string to short format like "Nov 15"
const formatLodgingDate = (isoString?: string): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  onSwipeDelete?: (activity: Activity) => void; // Callback for swipe-left-to-delete
  deleteSavedPlace?: boolean; // When true (e.g. CitySavedPlacesModal), reduce swipeDeleteAction marginBottom to 10
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
  currentUserRole,
  onSwipeDelete,
  deleteSavedPlace = false,
}: ActivityCardProps) {
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const dragValueRef = useRef(0);
  const dragXListenerRef = useRef<{ dragX: any; id: string } | null>(null);
  const isSwipeOpenRef = useRef(false);
  const deleteTriggeredRef = useRef(false);

  // Refs for stable access inside Animated listener
  const onSwipeDeleteRef = useRef(onSwipeDelete);
  onSwipeDeleteRef.current = onSwipeDelete;
  const activityRef = useRef(activity);
  activityRef.current = activity;

  // Cleanup drag listener on unmount
  useEffect(() => {
    return () => {
      if (dragXListenerRef.current) {
        dragXListenerRef.current.dragX.removeListener(dragXListenerRef.current.id);
      }
    };
  }, []);

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

  const renderRightActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    // Track drag value for full-swipe detection
    if (!dragXListenerRef.current || dragXListenerRef.current.dragX !== dragX) {
      if (dragXListenerRef.current) {
        dragXListenerRef.current.dragX.removeListener(dragXListenerRef.current.id);
      }
      const id = dragX.addListener(({ value }: { value: number }) => {
        dragValueRef.current = value;

        // Case 1: Already open (trash revealed) -> Swipe further left to delete
        // Threshold: -100 (20px past the 80px open width)
        if (isSwipeOpenRef.current && value < -100 && !deleteTriggeredRef.current) {
          deleteTriggeredRef.current = true;
          swipeableRef.current?.close();
          onSwipeDeleteRef.current?.(activityRef.current);
        }

        // Case 2: Closed -> Full swipe left to delete in one go
        // Threshold: -200
        if (!isSwipeOpenRef.current && value < -200 && !deleteTriggeredRef.current) {
          deleteTriggeredRef.current = true;
          swipeableRef.current?.close();
          onSwipeDeleteRef.current?.(activityRef.current);
        }
      });
      dragXListenerRef.current = { dragX, id };
    }

    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={[styles.swipeDeleteAction, deleteSavedPlace && { marginBottom: 5 }]}
        onPress={() => {
          swipeableRef.current?.close();
          onSwipeDelete?.(activity);
        }}
        activeOpacity={0.7}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialIcons name="delete" size={36} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Card tap always opens detail view; selection is only via the checkbox
  const handleCardTap = () => {
    if (disabled) return;
    if (onDescriptionCardPress) {
      onDescriptionCardPress(activity);
    } else if (onPress) {
      onPress(activity);
    }
  };

  // Determine hotel context from lodgingContext field (notes is now free for user notes)
  const knownContexts = ['Check-in', 'Check-out', 'Check-in / Check-out'];
  const notesIsContext = isHotel && !!(activity.notes && knownContexts.includes(activity.notes));
  const hotelContext = isHotel ? ((activity as any).lodgingContext || (notesIsContext ? activity.notes : '')) : '';

  // Migrate old hotels: move context from notes to lodgingContext so notes is free for user use
  const { updateActivityNotes: migrateNotes } = useCreateTrip();
  useEffect(() => {
    if (isHotel && notesIsContext && !(activity as any).lodgingContext && activity.instanceId) {
      migrateNotes(activity.instanceId, { lodgingContext: activity.notes, notes: '' });
    }
  }, [isHotel, notesIsContext, (activity as any).lodgingContext, activity.instanceId]);
  const isCheckIn = hotelContext.includes('Check-in');
  const isCheckOut = hotelContext.includes('Check-out');
  const isSameDay = hotelContext === 'Check-in / Check-out';
  const isMiddleDay = isHotel && !isCheckIn && !isCheckOut;
  const nights = isHotel ? calculateNights(activity.lodgingCheckIn, activity.lodgingCheckOut) : 0;

  // For hotels: get the relevant time for this card's context
  const hotelDisplayTime = isHotel ? (
    isCheckOut ? format12Hour(activity.lodgingTime?.checkOut) :
    isCheckIn ? format12Hour(activity.lodgingTime?.checkIn) :
    ''
  ) : '';

  const hotelCardContent = isHotel ? (
    <View style={styles.cardOuter}>
      <TouchableOpacity
        style={[
          styles.hotelCard,
          style,
          (isSelected || duplicateActivityIndicator) && styles.hotelCardSelected,
          disabled && styles.cardDisabled,
        ]}
        onPress={handleCardTap}
        onLongPress={handleLongPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {/* Selection indicator for hotels */}
        {showSelectionIndicator && (
          <TouchableOpacity
            style={styles.hotelSelectBtn}
            onPress={handlePress}
            disabled={disabled || duplicateActivityIndicator}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[
              styles.selectCircle,
              (isSelected || duplicateActivityIndicator) && styles.selectCircleActive,
            ]}>
              {(isSelected || duplicateActivityIndicator) && <Text style={styles.selectCheck}>✓</Text>}
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.hotelInfo}>
          {/* Row 1: bed icon + name */}
          <View style={styles.hotelNameRow}>
            <MaterialIcons name="bed" size={14} color="#6366F1" />
            <Text style={[styles.hotelName, disabled && styles.nameDisabled]} numberOfLines={1}>
              {activity.name}
            </Text>
          </View>

          {/* Row 2: rating · context · nights · time */}
          <View style={styles.hotelMetaRow}>
            {activity.rating && (
              <>
                <FontAwesome name="star" size={9} color="#F59E0B" />
                <Text style={styles.hotelRating}>{activity.rating}</Text>
              </>
            )}
            {activity.rating && (isSameDay || isCheckIn || isCheckOut || isMiddleDay) && (
              <Text style={styles.hotelMetaDot}>·</Text>
            )}
            {isSameDay ? (
              <Text style={styles.hotelContextText}>Same-day stay</Text>
            ) : isCheckIn ? (
              <Text style={styles.hotelContextText}>Check-in</Text>
            ) : isCheckOut ? (
              <Text style={styles.hotelContextText}>Check-out</Text>
            ) : isMiddleDay ? (
              <Text style={styles.hotelContextText}>Staying overnight</Text>
            ) : null}
            {nights > 0 && (
              <>
                <Text style={styles.hotelMetaDot}>·</Text>
                <Text style={styles.nightsText}>{nights}n</Text>
              </>
            )}
            {!hideNotesButton && !disabled && currentUserRole !== 'viewer' && (isCheckIn || isCheckOut || isSameDay) && (
              <TouchableOpacity
                style={styles.hotelTimeBadge}
                onPress={() => setNotesModalVisible(true)}
                activeOpacity={0.6}
              >
                <MaterialIcons name="schedule" size={9} color="#6366F1" />
                {(isCheckIn || isSameDay) && activity.lodgingTime?.checkIn ? (
                  <Text style={styles.hotelTimeText}>{format12Hour(activity.lodgingTime.checkIn)}</Text>
                ) : (isCheckOut || isSameDay) && activity.lodgingTime?.checkOut ? (
                  <Text style={styles.hotelTimeText}>{format12Hour(activity.lodgingTime.checkOut)}</Text>
                ) : null}
              </TouchableOpacity>
            )}
          </View>

          {/* Row 3: user notes */}
          {activity.notes ? (
            <TouchableOpacity
              style={styles.hotelNotesRow}
              onPress={() => !disabled && currentUserRole !== 'viewer' && setNotesModalVisible(true)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="edit" size={9} color="#A78BFA" />
              <Text style={styles.hotelNotesText} numberOfLines={1}>{activity.notes}</Text>
            </TouchableOpacity>
          ) : !hideNotesButton && !disabled && currentUserRole !== 'viewer' ? (
            <TouchableOpacity
              style={styles.hotelAddNotes}
              onPress={() => setNotesModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.hotelAddNotesLabel}>+ Add notes</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      <AddNotesModal
        visible={notesModalVisible}
        onClose={() => setNotesModalVisible(false)}
        activity={activity}
        activeTab={activeTab}
        currentUserRole={currentUserRole}
        hotelTimeMode={isCheckIn ? 'checkin' : isCheckOut ? 'checkout' : isSameDay ? 'both' : undefined}
      />
    </View>
  ) : null;

  const regularCardContent = (
    <View style={styles.cardOuter}>
      <TouchableOpacity
        style={[
          styles.card,
          style,
          (isSelected || duplicateActivityIndicator) && styles.cardSelected,
          disabled && styles.cardDisabled,
        ]}
        onPress={handleCardTap}
        onLongPress={handleLongPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {/* Photo */}
        <View style={styles.photoWrap}>
          <ActivityImage
            photo_reference={activity.photo_reference || ''}
            place_id={activity.place_id}
            style={[styles.photo, disabled && styles.photoDisabled]}
            activityName={activity.name}
            primaryType={activity.primaryType}
            types={activity.types}
          />
          {/* Selection badge overlaid on photo */}
          {showSelectionIndicator && (
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={handlePress}
              disabled={disabled || duplicateActivityIndicator}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[
                styles.selectCircle,
                (isSelected || duplicateActivityIndicator) && styles.selectCircleActive,
              ]}>
                {(isSelected || duplicateActivityIndicator) && <Text style={styles.selectCheck}>✓</Text>}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          {/* Top row: name + time badge or clock button on right */}
          <View style={styles.nameRow}>
            <Text style={[styles.name, disabled && styles.nameDisabled]} numberOfLines={2}>
              {getDisplayName()}
            </Text>
            {activity.startTime && activity.endTime ? (
              <TouchableOpacity
                style={styles.timeBadge}
                onPress={() => !disabled && currentUserRole !== 'viewer' && setNotesModalVisible(true)}
                activeOpacity={0.6}
              >
                <MaterialIcons name="schedule" size={10} color="#3B82F6" />
                <Text style={styles.timeText}>{format12Hour(activity.startTime)} – {format12Hour(activity.endTime)}</Text>
              </TouchableOpacity>
            ) : !hideNotesButton && !disabled && currentUserRole !== 'viewer' ? (
              <TouchableOpacity
                style={styles.clockBtn}
                onPress={() => setNotesModalVisible(true)}
                activeOpacity={0.6}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialIcons name="schedule" size={14} color="#D4D4D8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.meta}>
            {activity.rating && (
              <>
                <FontAwesome name="star" size={10} color="#F59E0B" />
                <Text style={styles.rating}>{activity.rating}</Text>
              </>
            )}
            {activity.rating && activity.primary_type_display_name && (
              <Text style={styles.metaDot}>·</Text>
            )}
            {activity.primary_type_display_name && (
              <Text style={styles.type} numberOfLines={1}>{activity.primary_type_display_name}</Text>
            )}
          </View>

          {/* Notes row */}
          {activity.notes ? (
            <TouchableOpacity
              style={styles.notesRow}
              onPress={() => !disabled && currentUserRole !== 'viewer' && setNotesModalVisible(true)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="edit" size={10} color="#A1A1AA" />
              <Text style={styles.notesText} numberOfLines={1}>{activity.notes}</Text>
            </TouchableOpacity>
          ) : !hideNotesButton ? (
            <TouchableOpacity
              style={styles.addNotes}
              onPress={() => setNotesModalVisible(true)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add" size={12} color="#C0C0C0" />
              <Text style={styles.addNotesLabel}>Add notes</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      <AddNotesModal
        visible={notesModalVisible}
        onClose={() => setNotesModalVisible(false)}
        activity={activity}
        activeTab={activeTab}
        currentUserRole={currentUserRole}
      />
    </View>
  );

  const cardContent = isHotel ? hotelCardContent! : regularCardContent;

  if (onSwipeDelete) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        onSwipeableOpen={(direction) => {
          if (direction === 'right' && !deleteTriggeredRef.current) {
            isSwipeOpenRef.current = true;
          }
        }}
        onSwipeableClose={() => {
          isSwipeOpenRef.current = false;
          deleteTriggeredRef.current = false;
        }}
      >
        {cardContent}
      </Swipeable>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  cardOuter: {
    marginBottom: 0,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 88,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#F36406',
  },
  cardDisabled: {
    opacity: 0.4,
  },

  // Photo
  photoWrap: {
    width: 88,
    height: 88,
    position: 'relative',
  },
  photo: {
    width: 88,
    height: 88,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  photoDisabled: {
    opacity: 0.5,
  },

  // Selection overlay on photo corner
  selectBtn: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  selectCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectCircleActive: {
    backgroundColor: '#F36406',
    borderColor: '#fff',
  },
  selectCheck: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Info section
  info: {
    flex: 1,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 12,
    justifyContent: 'center',
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  name: {
    fontFamily: 'outfit-bold',
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 19,
    letterSpacing: -0.2,
    flex: 1,
  },
  clockBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -2,
  },
  nameDisabled: {
    color: '#B0B0B0',
  },

  // Meta line: ★ 4.9 · Category
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
    color: '#71717A',
  },
  metaDot: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#D4D4D8',
  },
  type: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#A1A1AA',
    flexShrink: 1,
  },

  // Time badge
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: -2,
  },
  timeText: {
    fontFamily: 'outfit-medium',
    fontSize: 10,
    color: '#3B82F6',
  },

  // Notes
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  notesText: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    flex: 1,
  },

  // Add notes
  addNotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  addNotesLabel: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: '#D4D4D8',
  },

  // Hotel card
  hotelCard: {
    backgroundColor: '#FAFAFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEDFC',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  hotelCardSelected: {
    backgroundColor: '#EDE9FE',
    borderColor: '#6366F1',
    borderWidth: 1.5,
    borderLeftWidth: 3,
  },
  hotelSelectBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  hotelInfo: {
    gap: 1,
  },
  hotelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 28,
  },
  hotelName: {
    fontFamily: 'outfit-bold',
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 18,
    letterSpacing: -0.2,
    flex: 1,
  },
  nightsText: {
    fontFamily: 'outfit-medium',
    fontSize: 11,
    color: '#8B5CF6',
  },
  hotelMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hotelRating: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: '#71717A',
  },
  hotelMetaDot: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: '#D4D4D8',
  },
  hotelContextText: {
    fontFamily: 'outfit-medium',
    fontSize: 11,
    color: '#7C3AED',
  },
  hotelTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 2,
  },
  hotelTimeText: {
    fontFamily: 'outfit-medium',
    fontSize: 10,
    color: '#8B5CF6',
  },
  hotelNotesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  hotelNotesText: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: '#7C3AED',
    flex: 1,
  },
  hotelAddNotes: {
    marginTop: 1,
  },
  hotelAddNotesLabel: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: '#A78BFA',
  },

  // Swipe delete
  swipeDeleteAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 14,
    marginLeft: 4,
  },
});
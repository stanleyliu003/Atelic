import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking, Image } from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Activity } from '../../types/activity.types';
import { ActivityPhotoCarousel } from './activity/ActivityPhotoCarousel';
import { AddNotesModal } from './activity/add_notes_modal';
import { useCreateTrip } from '../../../context/CreateTripContext';

interface ActivityDetailViewProps {
  activity: Activity;
  onClose: () => void;
  variant?: 'trip' | 'wishlist';
  showDragIndicator?: boolean;
  onDuplicate?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void;
  currentUserRole?: 'owner' | 'editor' | 'viewer';
  activeTab?: 'wishlist' | string;
}

const formatNumber = (num: number) => {
  return num.toLocaleString();
};

const formatTimeAgo = (timestamp: number) => {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
};

const calculateDuration = (startTime: string, endTime: string): string => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const diffMinutes = endMinutes - startMinutes;

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
};

const renderStars = (rating: number) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.1 && rating % 1 <= 0.9;
  const totalStars = 5;

  // Add full golden stars
  for (let i = 0; i < fullStars; i++) {
    stars.push(
      <FontAwesome 
        key={`full-${i}`} 
        name="star" 
        size={16} 
        color="#FABC05" 
        style={{ marginRight: 2 }}
      />
    );
  }

  // Add half star if applicable
  if (hasHalfStar) {
    stars.push(
      <FontAwesome 
        key="half" 
        name="star-half-full" 
        size={16} 
        color="#FABC05" 
        style={{ marginRight: 2 }}
      />
    );
  }

  // Add gray stars for the remaining
  const grayStarsCount = totalStars - fullStars - (hasHalfStar ? 1 : 0);
  for (let i = 0; i < grayStarsCount; i++) {
    stars.push(
      <FontAwesome 
        key={`gray-${i}`} 
        name="star" 
        size={16} 
        color="#D9DCE0" 
        style={{ marginRight: 2 }}
      />
    );
  }

  return stars;
};

export function ActivityDetailView({ activity, onClose, variant = 'trip', showDragIndicator = true, onDuplicate, onDelete, currentUserRole, activeTab }: ActivityDetailViewProps) {
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Set<number>>(new Set());

  // Get live activity data from context for real-time updates
  const { activities, dayActivities } = useCreateTrip();

  // Find the current activity by instanceId to get live updates
  const getLiveActivity = (): Activity => {
    // First check wishlist
    const wishlistActivity = activities.find(a => a.instanceId === activity.instanceId);
    if (wishlistActivity) return wishlistActivity;

    // Then check all days
    for (const dayNum of Object.keys(dayActivities)) {
      const dayActivity = dayActivities[dayNum]?.activities?.find(
        (a: Activity) => a.instanceId === activity.instanceId
      );
      if (dayActivity) return dayActivity;
    }

    // Fallback to prop if not found (shouldn't happen)
    return activity;
  };

  // Use live activity data for display
  const liveActivity = getLiveActivity();

  const handleDuplicate = () => {
    if (onDuplicate) {
      onDuplicate(activity);
      onClose(); // Close the detail view after duplicating
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(activity);
      onClose(); // Close the detail view after deleting
    }
  };

  // Swipe down gesture to close
  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      // Close if either:
      // 1. Swiped down more than 50px (slow deliberate swipe), OR
      // 2. Fast downward swipe with velocity > 500 (quick flick)
      const shouldClose =
        (event.translationY > 25 && event.velocityY >= 0) || // Slow swipe down
        (event.velocityY > 500); // Fast swipe down

      if (shouldClose) {
        runOnJS(onClose)();
      }
    });

  const toggleReviewExpansion = (index: number) => {
    const newExpanded = new Set(expandedReviews);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedReviews(newExpanded);
  };

  const handleWebsitePress = async () => {
    if (liveActivity.website_uri) {
      try {
        const supported = await Linking.canOpenURL(liveActivity.website_uri);
        if (supported) {
          await Linking.openURL(liveActivity.website_uri);
        } else {
          console.log("Don't know how to open URI: " + liveActivity.website_uri);
        }
      } catch (error) {
        console.error('An error occurred', error);
      }
    }
  };

  const parseTimeToMinutes = (timeStr: string): number => {
    // Parse time strings like "9:00 AM", "11:30 PM", "12:00 AM"
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return -1;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  };

  const getCurrentDayAndTime = () => {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return { currentDay, currentMinutes };
  };

  const getHoursStatus = () => {
    if (!liveActivity.regular_opening_hours?.weekday_text) {
      return { status: 'unknown', statusText: 'Hours not available', timeText: '' };
    }

    const { currentDay, currentMinutes } = getCurrentDayAndTime();

    // Find today's hours
    const todayHours = liveActivity.regular_opening_hours.weekday_text.find(day =>
      day.toLowerCase().startsWith(currentDay.toLowerCase())
    );

    if (!todayHours) {
      return { status: 'unknown', statusText: 'Hours not available', timeText: '' };
    }

    // Check if closed today
    if (todayHours.toLowerCase().includes('closed')) {
      // Find next open day
      const dayIndex = new Date().getDay();
      for (let i = 1; i <= 7; i++) {
        const nextDayIndex = (dayIndex + i) % 7;
        const nextDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextDayIndex];
        const nextDayHours = liveActivity.regular_opening_hours.weekday_text.find(day =>
          day.toLowerCase().startsWith(nextDayName.toLowerCase())
        );
        
        if (nextDayHours && !nextDayHours.toLowerCase().includes('closed')) {
          const timeMatch = nextDayHours.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
          if (timeMatch) {
            const openTime = timeMatch[1];
            const dayText = i === 1 ? 'tomorrow' : nextDayName;
            return { 
              status: 'closed', 
              statusText: 'Closed',
              timeText: ` ⋅ Opens ${openTime} ${i === 1 ? '' : dayText}`.trim(),
              color: '#DC2626'
            };
          }
        }
      }
      return { status: 'closed', statusText: 'Closed', timeText: '', color: '#DC2626' };
    }

    // Parse open hours for today - handle multiple time periods (split shifts)
    // Match all time ranges in the string
    // Supports formats: "5:00 PM – 10:00 PM" or "5:00 – 10:00 PM" (AM/PM shared)
    const timeRanges = todayHours.matchAll(/(\d{1,2}:\d{2})(?:\s*([AP]M))?\s*[–-]\s*(\d{1,2}:\d{2})\s*([AP]M)/gi);
    const ranges = Array.from(timeRanges);

    if (ranges.length === 0) {
      // Check for 24-hour format
      if (todayHours.toLowerCase().includes('24 hours') || todayHours.toLowerCase().includes('open 24 hours')) {
        return { status: 'open', statusText: 'Open', timeText: ' ⋅ 24 hours', color: '#16A34A' };
      }
      // If format cannot be parsed but we have hours text, show it as-is
      if (todayHours.trim()) {
        return { status: 'unknown', statusText: '', timeText: todayHours.trim(), color: '#6B7280' };
      }
      return { status: 'unknown', statusText: 'Hours unavailable', timeText: '', color: '#6B7280' };
    }

    // Check each time range to see if we're currently open
    let isOpen = false;
    let currentRange = null;
    let nextRange = null;

    for (const match of ranges) {
      // Extract time components
      const openTimeNum = match[1];       // e.g., "5:00"
      const openPeriod = match[2];        // e.g., "PM" or undefined
      const closeTimeNum = match[3];      // e.g., "10:00"
      const closePeriod = match[4];       // e.g., "PM"

      // If opening time doesn't have AM/PM, use the same as closing time
      const openTime = openPeriod ? `${openTimeNum} ${openPeriod}` : `${openTimeNum} ${closePeriod}`;
      const closeTime = `${closeTimeNum} ${closePeriod}`;

      const openMinutes = parseTimeToMinutes(openTime);
      const closeMinutes = parseTimeToMinutes(closeTime);

      if (openMinutes === -1 || closeMinutes === -1) continue;

      // Handle overnight hours (e.g., 10 PM - 2 AM)
      const isOvernightHours = closeMinutes < openMinutes;

      let isOpenInThisRange = false;
      if (isOvernightHours) {
        isOpenInThisRange = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
      } else {
        isOpenInThisRange = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
      }

      if (isOpenInThisRange) {
        isOpen = true;
        currentRange = { openTime, closeTime, openMinutes, closeMinutes, isOvernightHours };
        break;
      }

      // Track next opening time if we're between shifts
      if (!nextRange && currentMinutes < openMinutes) {
        nextRange = { openTime, closeTime, openMinutes };
      }
    }

    // If not open in any range, use the first range for display
    if (!currentRange && ranges.length > 0) {
      const match = ranges[0];
      const openTimeNum = match[1];
      const openPeriod = match[2];
      const closeTimeNum = match[3];
      const closePeriod = match[4];

      const openTime = openPeriod ? `${openTimeNum} ${openPeriod}` : `${openTimeNum} ${closePeriod}`;
      const closeTime = `${closeTimeNum} ${closePeriod}`;

      currentRange = {
        openTime,
        closeTime,
        openMinutes: parseTimeToMinutes(openTime),
        closeMinutes: parseTimeToMinutes(closeTime),
        isOvernightHours: parseTimeToMinutes(closeTime) < parseTimeToMinutes(openTime)
      };
    }

    if (isOpen && currentRange) {
      return {
        status: 'open',
        statusText: 'Open',
        timeText: ` ⋅ Closes ${currentRange.closeTime}`,
        color: '#16A34A'
      };
    } else {
      // Use nextRange if available (for split shifts), otherwise use currentRange
      const rangeToUse = nextRange || currentRange;
      if (!rangeToUse) {
        return { status: 'closed', statusText: 'Closed', timeText: '', color: '#DC2626' };
      }

      // Check if will open later today
      if (!currentRange?.isOvernightHours && currentMinutes < rangeToUse.openMinutes) {
        return {
          status: 'closed',
          statusText: 'Closed',
          timeText: ` ⋅ Opens ${rangeToUse.openTime}`,
          color: '#DC2626'
        };
      } else {
        // Will open tomorrow or next day
        return {
          status: 'closed',
          statusText: 'Closed',
          timeText: ` ⋅ Opens ${rangeToUse.openTime} tomorrow`,
          color: '#DC2626'
        };
      }
    }
  };

  const hoursStatus = getHoursStatus();
  console.log(`[description_card] Hours status for ${liveActivity.name}:`, hoursStatus);

  return (
    <GestureHandlerRootView style={[styles.container, variant === 'wishlist' && styles.containerWishlist]}>
      {/* Swipeable Drag Indicator */}
      {showDragIndicator && (
        <GestureDetector gesture={swipeGesture}>
          <View style={[styles.dragIndicatorContainer, variant === 'wishlist' && styles.dragIndicatorContainerWishlist]}>
            <View style={styles.dragIndicator} />
          </View>
        </GestureDetector>
      )}

      {/* Close Button - positioned relative to entire container */}
      <TouchableOpacity onPress={onClose} style={[styles.closeButton, variant === 'wishlist' && styles.closeButtonWishlist]}>
        <Ionicons name="close" size={24} color="#000" />
      </TouchableOpacity>

      {/* Scrollable Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Activity Photo Carousel */}
        <View style={styles.heroImageContainer}>
          <ActivityPhotoCarousel
            activity={liveActivity}
            height={250}
          />
        </View>

        {/* Category and Status Badges */}
        <View style={styles.badgeRow}>
          {liveActivity.primary_type_display_name && (
            <View style={styles.categoryBadge}>
              <MaterialCommunityIcons name="tag" size={12} color="#9CA3AF" />
              <Text style={styles.categoryText}>{liveActivity.primary_type_display_name}</Text>
            </View>
          )}

          {/* Open/Closed Badge */}
          {(hoursStatus.status === 'open' || hoursStatus.status === 'closed') && (
            <View style={[
              styles.hoursStatusBadge,
              hoursStatus.status === 'open' && styles.hoursStatusBadgeOpen,
              hoursStatus.status === 'closed' && styles.hoursStatusBadgeClosed
            ]}>
              <View style={[
                styles.statusDot,
                hoursStatus.status === 'open' && styles.statusDotOpen,
                hoursStatus.status === 'closed' && styles.statusDotClosed
              ]} />
              <Text style={[
                styles.hoursStatusBadgeText,
                hoursStatus.status === 'open' && styles.hoursStatusBadgeTextOpen,
                hoursStatus.status === 'closed' && styles.hoursStatusBadgeTextClosed
              ]}>
                {hoursStatus.statusText}
              </Text>
            </View>
          )}
        </View>

        {/* Activity Name */}
        <Text style={styles.activityNameMain}>{liveActivity.name}</Text>

        {/* Rating and Review Count */}
        {liveActivity.rating && (
          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {renderStars(liveActivity.rating)}
            </View>
            <Text style={styles.ratingText}>{liveActivity.rating}</Text>
            {liveActivity.user_ratings_total && (
              <Text style={styles.ratingsCountText}>
                ({formatNumber(liveActivity.user_ratings_total)})
              </Text>
            )}
          </View>
        )}

        {/* Editorial Summary */}
        {liveActivity.editorial_summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{liveActivity.editorial_summary}</Text>
          </View>
        )}

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${liveActivity.lat},${liveActivity.lng}`)}>
            <MaterialIcons name="directions" size={20} color="#333" />
            <Text style={styles.actionButtonText}>Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <MaterialCommunityIcons name="share-outline" size={20} color="#333" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleWebsitePress}>
            <MaterialIcons name="language" size={20} color="#333" />
            <Text style={styles.actionButtonText}>Website</Text>
          </TouchableOpacity>
        </View>

        {/* Planned Time Section */}
        {(liveActivity.startTime || liveActivity.endTime) && currentUserRole !== 'viewer' && (
          <TouchableOpacity
            style={styles.plannedTimeContainer}
            onPress={() => setNotesModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.plannedTimeHeader}>
              <MaterialIcons name="access-time" size={20} color="#333" />
              <Text style={styles.plannedTimeTitle}>Planned Time</Text>
              <MaterialIcons name="edit" size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
            </View>
            <View style={styles.plannedTimeRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>START</Text>
                <Text style={styles.timeValue}>{liveActivity.startTime || '--'}</Text>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>END</Text>
                <Text style={styles.timeValue}>{liveActivity.endTime || '--'}</Text>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>DURATION</Text>
                <Text style={styles.timeValue}>
                  {liveActivity.startTime && liveActivity.endTime
                    ? calculateDuration(liveActivity.startTime, liveActivity.endTime)
                    : '--'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        {(liveActivity.startTime || liveActivity.endTime) && currentUserRole === 'viewer' && (
          <View style={styles.plannedTimeContainer}>
            <View style={styles.plannedTimeHeader}>
              <MaterialIcons name="access-time" size={20} color="#333" />
              <Text style={styles.plannedTimeTitle}>Planned Time</Text>
            </View>
            <View style={styles.plannedTimeRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>START</Text>
                <Text style={styles.timeValue}>{liveActivity.startTime || '--'}</Text>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>END</Text>
                <Text style={styles.timeValue}>{liveActivity.endTime || '--'}</Text>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>DURATION</Text>
                <Text style={styles.timeValue}>
                  {liveActivity.startTime && liveActivity.endTime
                    ? calculateDuration(liveActivity.startTime, liveActivity.endTime)
                    : '--'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Your Notes Section */}
        {liveActivity.notes && currentUserRole !== 'viewer' && (
          <TouchableOpacity
            style={styles.notesContainer}
            onPress={() => setNotesModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.notesHeader}>
              <MaterialCommunityIcons name="note-text-outline" size={20} color="#333" />
              <Text style={styles.notesTitle}>Your Notes</Text>
              <MaterialIcons name="edit" size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
            </View>
            <Text style={styles.notesText}>{liveActivity.notes}</Text>
          </TouchableOpacity>
        )}
        {liveActivity.notes && currentUserRole === 'viewer' && (
          <View style={styles.notesContainer}>
            <View style={styles.notesHeader}>
              <MaterialCommunityIcons name="note-text-outline" size={20} color="#333" />
              <Text style={styles.notesTitle}>Your Notes</Text>
            </View>
            <Text style={styles.notesText}>{liveActivity.notes}</Text>
          </View>
        )}

        {/* Address */}
        {liveActivity.formatted_address && (
          <View style={styles.infoCard}>
            <View style={styles.infoSection}>
              <MaterialIcons name="place" size={24} color="#333" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>ADDRESS</Text>
                <Text style={styles.infoText}>{liveActivity.formatted_address}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Hours */}
        {liveActivity.regular_opening_hours?.weekday_text && (
          <View style={styles.infoCard}>
            <View style={styles.infoSection}>
              <MaterialIcons name="access-time" size={24} color="#333" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>HOURS</Text>
                <TouchableOpacity
                  onPress={() => setHoursExpanded(!hoursExpanded)}
                  style={styles.hoursToggle}
                >
                  <Text style={[styles.hoursStatusText, { color: hoursStatus.color }]}>
                    {hoursStatus.statusText} {hoursStatus.timeText}
                  </Text>
                  <Ionicons
                    name={hoursExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#999"
                  />
                </TouchableOpacity>
                {hoursExpanded && (
                  <View style={styles.expandedHoursContainer}>
                    {liveActivity.regular_opening_hours.weekday_text.map((dayHours, index) => (
                      <Text key={index} style={styles.hoursText}>{dayHours}</Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Phone */}
        {liveActivity.international_phone_number && (
          <View style={styles.infoCard}>
            <View style={styles.infoSection}>
              <MaterialIcons name="phone" size={24} color="#333" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>PHONE</Text>
                <Text style={styles.infoText}>{liveActivity.international_phone_number}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Top Reviews */}
        {liveActivity.reviews && liveActivity.reviews.length > 0 && (
          <View style={styles.reviewsContainer}>
            <Text style={styles.reviewsLabel}>Top Reviews</Text>
            {liveActivity.reviews.slice(0, 5).map((review, index) => (
              <View key={index} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Image 
                    source={{ uri: review.profile_photo_url }} 
                    style={styles.reviewProfilePhoto}
                  />
                  <View style={styles.reviewHeaderText}>
                    <Text style={styles.reviewAuthorName}>{review.author_name}</Text>
                    <Text style={styles.reviewTime}>{formatTimeAgo(review.time || 0)}</Text>
                  </View>
                </View>
                <View style={styles.reviewRating}>
                  {review.rating && renderStars(review.rating)}
                </View>
                {review.text && (
                  <View style={styles.reviewTextContainer}>
                    {expandedReviews.has(index) ? (
                      <Text style={styles.reviewText}>
                        {review.text}
                        <Text> </Text>
                        <Text 
                          style={styles.moreButton} 
                          onPress={() => toggleReviewExpansion(index)}
                        >
                          less
                        </Text>
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.reviewText} numberOfLines={3}>
                          {review.text}
                        </Text>
                        {review.text.length > 150 && (
                          <TouchableOpacity 
                            style={styles.moreButtonContainer}
                            onPress={() => toggleReviewExpansion(index)}
                          >
                            <Text style={styles.ellipsisText}>...</Text>
                            <Text style={styles.moreText}> more</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Fixed Action Buttons at Bottom Right */}
      {(onDuplicate || onDelete) && currentUserRole !== 'viewer' && (
        <View style={styles.actionButtonContainer}>
          {onDuplicate && (
            <TouchableOpacity
              style={styles.duplicateButton}
              onPress={handleDuplicate}
              activeOpacity={0.7}
            >
              <Feather name="copy" size={22} color={Colors.PRIMARY} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Feather name="trash" size={22} color="red" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Add Notes Modal */}
      <AddNotesModal
        visible={notesModalVisible}
        onClose={() => setNotesModalVisible(false)}
        activity={liveActivity}
        activeTab={activeTab || (variant === 'wishlist' ? 'wishlist' : (liveActivity.dayNumber ? `day${liveActivity.dayNumber}` : 'wishlist'))}
        currentUserRole={currentUserRole}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
  },
  containerWishlist: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  dragIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingTop: 8,
  },
  dragIndicatorContainerWishlist: {
    marginTop: 15,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButtonWishlist: {
    top: 12,
    right: 15,
  },
  content: {
    flex: 1,
    paddingTop: 0,
  },
  heroImageContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 16,
  },
  spacerLine: {
    height: 1,
    backgroundColor: '#D9DCE0',
    marginVertical: 15,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  categoryText: {
    fontSize: 13,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  hoursStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  hoursStatusBadgeOpen: {
    backgroundColor: '#ECFDF5',
  },
  hoursStatusBadgeClosed: {
    backgroundColor: '#FEF2F2',
  },
  hoursStatusBadgeText: {
    fontSize: 12,
  },
  hoursStatusBadgeTextOpen: {
    color: '#059669',
  },
  hoursStatusBadgeTextClosed: {
    color: '#DC2626',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOpen: {
    backgroundColor: '#10B981',
  },
  statusDotClosed: {
    backgroundColor: '#EF4444',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginRight: 6,
  },
  ratingsCountText: {
    fontSize: 16,
    color: '#6B7280',
  },
  typeText: {
    fontSize: 16,
    color: Colors.GRAY,
    textTransform: 'capitalize',
    marginBottom: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginLeft: 12,
    flex: 1,
  },
  cityContainer: {
    marginBottom: 20,
  },
  cityText: {
    fontSize: 16,
    color: '#333',
  },
  coordinatesContainer: {
    marginBottom: 20,
  },
  coordinatesText: {
    fontSize: 14,
    color: '#666',
  },
  placeIdContainer: {
    marginBottom: 20,
  },
  placeIdLabel: {
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 5,
  },
  placeIdText: {
    fontSize: 12,
    color: '#666',
  },
  recommendationContainer: {
    marginBottom: 30,
  },
  recommendationLabel: {
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 5,
  },
  recommendationText: {
    fontSize: 16,
    color: '#333',
  },
  hoursContainer: {
    marginBottom: 20,
  },
  hoursLabel: {
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 8,
  },
  hoursText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 2,
  },
  websiteTouchable: {
    flex: 1,
    marginLeft: 12,
  },
  websiteText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  hoursMainContainer: {
    marginBottom: 15,
  },
  hoursHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 8,
  },
  hoursStatusContainer: {
    flex: 1,
    marginLeft: 12,
  },
  hoursStatusText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
    flex: 1,
  },
  expandedHoursContainer: {
    marginTop: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  googleLogo: {
    height: 16,
    width: 16,
    marginLeft: 8,
    marginTop: -4,
  },
  bottomSpacing: {
    height: 30,
  },
  reviewsContainer: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  reviewsLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  reviewItem: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewProfilePhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewHeaderText: {
    flex: 1,
  },
  reviewAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  reviewTime: {
    fontSize: 12,
    color: Colors.GRAY,
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 52,
  },
  reviewTextContainer: {
    marginLeft: 52,
    position: 'relative',
  },
  reviewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  moreButtonContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.WHITE,
    paddingLeft: 1,
    flexDirection: 'row',
  },
  ellipsisText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  moreText: {
    fontSize: 14,
    color: Colors.GRAY,
    textDecorationLine: 'underline',
    lineHeight: 20,
  },
  moreButton: {
    fontSize: 14,
    color: Colors.GRAY,
    textDecorationLine: 'underline',
  },
  actionButtonContainer: {
    position: 'absolute',
    bottom: 0,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  deleteButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.WHITE,
    borderRadius: 33,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  duplicateButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.WHITE,
    borderRadius: 33,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  // Activity Name (in content)
  activityNameMain: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  // Action Buttons Row
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  // Planned Time Section
  plannedTimeContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#DBEAFE',
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  plannedTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  plannedTimeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  plannedTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeDivider: {
    width: 0.5,
    backgroundColor: '#DBEAFE',
    marginHorizontal: 10,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 5,
    letterSpacing: 0.8,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  // Your Notes Section
  notesContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // Info Card Wrapper (Address, Hours, Phone)
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  // Info Sections (Address, Hours, Phone)
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 21,
  },
  hoursToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

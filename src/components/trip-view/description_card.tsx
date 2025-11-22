import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Feather from '@expo/vector-icons/Feather';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking, Image } from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Activity } from '../../types/activity.types';
import { ActivityImage } from './activity/activity_image';

interface ActivityDetailViewProps {
  activity: Activity;
  onClose: () => void;
  variant?: 'trip' | 'wishlist';
  showDragIndicator?: boolean;
  onDuplicate?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void;
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

export function ActivityDetailView({ activity, onClose, variant = 'trip', showDragIndicator = true, onDuplicate, onDelete }: ActivityDetailViewProps) {
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Set<number>>(new Set());

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
    if (activity.website_uri) {
      try {
        const supported = await Linking.canOpenURL(activity.website_uri);
        if (supported) {
          await Linking.openURL(activity.website_uri);
        } else {
          console.log("Don't know how to open URI: " + activity.website_uri);
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
    if (!activity.regular_opening_hours?.weekday_text) {
      return { status: 'unknown', statusText: 'Hours not available', timeText: '' };
    }

    const { currentDay, currentMinutes } = getCurrentDayAndTime();
    
    // Find today's hours
    const todayHours = activity.regular_opening_hours.weekday_text.find(day => 
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
        const nextDayHours = activity.regular_opening_hours.weekday_text.find(day => 
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

    // Parse open hours for today
    const timeMatch = todayHours.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*[–-]\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (!timeMatch) {
      // Check for 24-hour format
      if (todayHours.toLowerCase().includes('24 hours') || todayHours.toLowerCase().includes('open 24 hours')) {
        return { status: 'open', statusText: 'Open', timeText: ' 24 hours', color: '#16A34A' };
      }
      return { status: 'unknown', statusText: 'Hours format not recognized', timeText: '' };
    }

    const openTime = timeMatch[1];
    const closeTime = timeMatch[2];
    const openMinutes = parseTimeToMinutes(openTime);
    const closeMinutes = parseTimeToMinutes(closeTime);

    if (openMinutes === -1 || closeMinutes === -1) {
      return { status: 'unknown', statusText: 'Hours format not recognized', timeText: '' };
    }

    // Handle overnight hours (e.g., 10 PM - 2 AM)
    const isOvernightHours = closeMinutes < openMinutes;
    
    let isOpen = false;
    if (isOvernightHours) {
      isOpen = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    } else {
      isOpen = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    }

    if (isOpen) {
      return { 
        status: 'open', 
        statusText: 'Open',
        timeText: ` ⋅ Closes ${closeTime}`,
        color: '#16A34A'
      };
    } else {
      // Check if will open later today
      if (!isOvernightHours && currentMinutes < openMinutes) {
        return { 
          status: 'closed', 
          statusText: 'Closed',
          timeText: ` ⋅ Opens ${openTime}`,
          color: '#DC2626'
        };
      } else {
        // Will open tomorrow or next day
        return { 
          status: 'closed', 
          statusText: 'Closed',
          timeText: ` ⋅ Opens ${openTime} tomorrow`,
          color: '#DC2626'
        };
      }
    }
  };

  const hoursStatus = getHoursStatus();

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

      {/* Fixed Header with Activity Name */}
      <View style={styles.fixedHeader}>
        <View style={styles.nameContainer}>
          <Text style={styles.activityName}>{activity.name}</Text>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Rating and Review Count */}
        {activity.rating && (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>{activity.rating}</Text>
            <View style={styles.starsContainer}>
              {renderStars(activity.rating)}
            </View>
            {activity.user_ratings_total && (
              <Text style={styles.ratingsCountText}>
                ({formatNumber(activity.user_ratings_total)})
              </Text>
            )}
          </View>
        )}
        
        {/* Primary Type */}
        {activity.primary_type_display_name && (
          <Text style={styles.typeText}>
            {activity.primary_type_display_name}
          </Text>
        )}

        {/* Activity Image */}
        <View style={styles.imageContainer}>
          <ActivityImage
            photo_reference={activity.photo_reference || ''}
            place_id={activity.place_id}
            style={styles.activityImage}
          />
        </View>

        {/* Editorial Summary */}
        {activity.editorial_summary && (
          <>
            <View style={styles.spacerLine} />
            <View style={styles.editorialContainer}>
              <Text style={styles.editorialText}>{activity.editorial_summary}</Text>
            </View>
            <View style={styles.spacerLine} />
          </>
        )}

        {/* Address */}
        {activity.formatted_address && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={24} color="#027B8B" />
            <Text style={styles.infoText}>{activity.formatted_address}</Text>
          </View>
        )}

        {/* Hours */}
        {activity.regular_opening_hours?.weekday_text && (
          <View style={styles.hoursMainContainer}>
            <TouchableOpacity 
              style={styles.hoursHeaderRow} 
              onPress={() => setHoursExpanded(!hoursExpanded)}
            >
              <FontAwesome6 name="clock" size={24} color="#027B8B" />
              <View style={styles.hoursStatusContainer}>
                <Text style={styles.hoursStatusText}>
                  <Text style={{ color: hoursStatus.color }}>
                    {hoursStatus.statusText}
                  </Text>
                  <Text style={{ color: '#333' }}>
                    {hoursStatus.timeText}
                  </Text>
                </Text>
              </View>
              <Ionicons 
                name={hoursExpanded ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            
            {hoursExpanded && (
              <View style={styles.expandedHoursContainer}>
                {activity.regular_opening_hours.weekday_text.map((dayHours, index) => (
                  <Text key={index} style={styles.hoursText}>{dayHours}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Website */}
        {activity.website_uri && (
          <View style={styles.infoRow}>
            <Entypo name="globe" size={24} color="#027B8B" />
            <TouchableOpacity onPress={handleWebsitePress} style={styles.websiteTouchable}>
              <Text style={styles.websiteText}>{activity.website_uri}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phone */}
        {activity.international_phone_number && (
          <View style={styles.infoRow}>
            <FontAwesome6 name="phone" size={24} color="#027B8B" />
            <Text style={styles.infoText}>{activity.international_phone_number}</Text>
          </View>
        )}

        {/* Recommendation Status */}
        <View style={styles.recommendationContainer}>
          <View style={styles.sourceRow}>
            <Text style={styles.recommendationLabel}>Source</Text>
            {activity.is_recommended && (
              <Image 
                source={require('../../../assets/Google_logo.webp')} 
                style={styles.googleLogo}
                resizeMode="contain"
              />
            )}
          </View>
          <Text style={styles.recommendationText}>
            {activity.is_recommended ? 'Recommended by Google' : 'Added by you'}
          </Text>
        </View>

        {/* Reviews */}
        {activity.reviews && activity.reviews.length > 0 && (
          <View style={styles.reviewsContainer}>
            <Text style={styles.reviewsLabel}>Reviews</Text>
            {activity.reviews.slice(0, 5).map((review, index) => (
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
      {(onDuplicate || onDelete) && (
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
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 10,
    zIndex: 1000,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingRight: 40,
  },
  closeButton: {
    position: 'absolute',
    top: -10,
    right: -15,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    zIndex: 2000,
    elevation: 4,
  },
  closeButtonWishlist: {
    top: 12,
    right: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 7,
  },
  imageContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 25,
  },
  activityImage: {
    width: 200,
    height: 200,
    borderRadius: 15,
  },
  spacerLine: {
    height: 1,
    backgroundColor: '#D9DCE0',
    marginVertical: 15,
  },
  editorialContainer: {
    marginBottom: 10,
  },
  editorialText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    textAlign: 'left',
  },
  activityName: {
    fontFamily: 'outfit-bold',
    fontSize: 24,
    color: Colors.PRIMARY,
    textAlign: 'left',
    flex: 1,
    marginRight: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 5,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  ratingText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
    marginRight: 8,
  },
  ratingsCountText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
  },
  typeText: {
    fontFamily: 'outfit',
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
    fontFamily: 'outfit',
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
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#333',
  },
  coordinatesContainer: {
    marginBottom: 20,
  },
  coordinatesText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  placeIdContainer: {
    marginBottom: 20,
  },
  placeIdLabel: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 5,
  },
  placeIdText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  recommendationContainer: {
    marginBottom: 30,
  },
  recommendationLabel: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 5,
  },
  recommendationText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#333',
  },
  hoursContainer: {
    marginBottom: 20,
  },
  hoursLabel: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 8,
  },
  hoursText: {
    fontFamily: 'outfit',
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
    fontFamily: 'outfit',
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
    fontFamily: 'outfit',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  expandedHoursContainer: {
    marginTop: 8,
    paddingLeft: 41,
    paddingRight: 5,
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
  },
  reviewsLabel: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 15,
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
    fontFamily: 'outfit',
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  reviewTime: {
    fontFamily: 'outfit',
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
    fontFamily: 'outfit',
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
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  moreText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    textDecorationLine: 'underline',
    lineHeight: 20,
  },
  moreButton: {
    fontFamily: 'outfit',
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
});

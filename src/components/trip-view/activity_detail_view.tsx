import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking, Image } from 'react-native';
import { Activity } from '../../types/activity.types';
import { ActivityImage } from './activity/activity_image';

interface ActivityDetailViewProps {
  activity: Activity;
  onClose: () => void;
}

const formatNumber = (num: number) => {
  return num.toLocaleString();
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

export function ActivityDetailView({ activity, onClose }: ActivityDetailViewProps) {
  const [hoursExpanded, setHoursExpanded] = useState(false);

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
    <View style={styles.container}>
      {/* Close Button - positioned relative to entire container */}
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={20} color="#000" />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
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
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 15,
    zIndex: 2000,
    elevation: 4,
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
});

import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
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

  return (
    <View style={styles.container}>
      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Activity Name with Close Button */}
        <View style={styles.nameContainer}>
          <Text style={styles.activityName}>{activity.name}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.WHITE} />
          </TouchableOpacity>
        </View>

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
          <View style={styles.infoRow}>
            <FontAwesome6 name="clock" size={24} color="#027B8B" />
            <Text style={styles.infoText}>Hours</Text>
            {activity.regular_opening_hours.weekday_text.map((dayHours, index) => (
              <Text key={index} style={styles.hoursText}>{dayHours}</Text>
            ))}
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
        {activity.phone && (
          <View style={styles.infoRow}>
            <FontAwesome6 name="phone" size={24} color="#027B8B" />
            <Text style={styles.infoText}>{activity.phone}</Text>
          </View>
        )}

        {/* Recommendation Status */}
        <View style={styles.recommendationContainer}>
          <Text style={styles.recommendationLabel}>Source</Text>
          <Text style={styles.recommendationText}>
            {activity.is_recommended ? 'Recommended by Atelic' : 'Added by you'}
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
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 15,
  },
  closeButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.PRIMARY,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
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
    fontSize: 28,
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
    marginBottom: 15,
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
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
});

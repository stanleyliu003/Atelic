import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Activity } from '../../types/activity.types';
import { ActivityImage } from './activity/activity_image';

interface ActivityDetailViewProps {
  activity: Activity;
  onClose: () => void;
}

export function ActivityDetailView({ activity, onClose }: ActivityDetailViewProps) {
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
            <Text style={styles.ratingText}>{activity.rating} ⭐</Text>
            {activity.user_ratings_total && (
              <Text style={styles.ratingsCountText}>
                ({activity.user_ratings_total})
              </Text>
            )}
          </View>
        )}
        
        {/* Primary Type */}
        {activity.primaryType && (
          <View style={styles.typesContainer}>
            <View style={styles.typeTag}>
              <Text style={styles.typeText}>
                {activity.primaryType.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
        )}

        {/* Hours */}
        {activity.regular_opening_hours?.weekday_text && (
          <View style={styles.hoursContainer}>
            <Text style={styles.hoursLabel}>Hours</Text>
            {activity.regular_opening_hours.weekday_text.map((dayHours, index) => (
              <Text key={index} style={styles.hoursText}>{dayHours}</Text>
            ))}
          </View>
        )}

        {/* Activity Image */}
        <View style={styles.imageContainer}>
          <ActivityImage 
            photo_reference={activity.photo_reference || ''} 
            style={styles.activityImage}
          />
        </View>

        {/* Address */}
        {activity.formatted_address && (
          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>Address</Text>
            <Text style={styles.addressText}>{activity.formatted_address}</Text>
          </View>
        )}

        {/* City */}
        {activity.city && (
          <View style={styles.cityContainer}>
            <Text style={styles.cityLabel}>City</Text>
            <Text style={styles.cityText}>{activity.city}</Text>
          </View>
        )}

        {/* Coordinates */}
        {activity.lat && activity.lng && (
          <View style={styles.coordinatesContainer}>
            <Text style={styles.coordinatesLabel}>Coordinates</Text>
            <Text style={styles.coordinatesText}>
              {activity.lat.toFixed(6)}, {activity.lng.toFixed(6)}
            </Text>
          </View>
        )}

        {/* Place ID */}
        {activity.place_id && (
          <View style={styles.placeIdContainer}>
            <Text style={styles.placeIdLabel}>Place ID</Text>
            <Text style={styles.placeIdText}>{activity.place_id}</Text>
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
    marginBottom: 15,
  },
  ratingText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: Colors.PRIMARY,
    marginRight: 8,
  },
  ratingsCountText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
  },
  typesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4,
    marginBottom: 7.5,
  },
  typeTag: {
    backgroundColor: '#e9ecef',
    borderRadius: 7.5,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  typeText: {
    fontFamily: 'outfit',
    fontSize: 7,
    color: Colors.GRAY,
    textTransform: 'capitalize',
  },
  addressContainer: {
    marginBottom: 20,
  },
  addressLabel: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 5,
  },
  addressText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  cityContainer: {
    marginBottom: 20,
  },
  cityLabel: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 5,
  },
  cityText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#333',
  },
  coordinatesContainer: {
    marginBottom: 20,
  },
  coordinatesLabel: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: Colors.PRIMARY,
    marginBottom: 5,
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
});

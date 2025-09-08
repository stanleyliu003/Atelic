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
      {/* Header with close button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={40} color={Colors.WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Activity Image */}
        <View style={styles.imageContainer}>
          <ActivityImage 
            photo_reference={activity.photo_reference || ''} 
            style={styles.activityImage}
          />
        </View>

        {/* Activity Name */}
        <Text style={styles.activityName}>{activity.name}</Text>

        {/* Rating and Types */}
        <View style={styles.statsContainer}>
          {activity.rating && (
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingText}>⭐ {activity.rating}</Text>
              {activity.user_ratings_total && (
                <Text style={styles.ratingsCountText}>
                  ({activity.user_ratings_total} reviews)
                </Text>
              )}
            </View>
          )}
          
          {activity.types && activity.types.length > 0 && (
            <View style={styles.typesContainer}>
              {activity.types.slice(0, 3).map((type, index) => (
                <View key={index} style={styles.typeTag}>
                  <Text style={styles.typeText}>
                    {type.replace(/_/g, ' ')}
                  </Text>
                </View>
              ))}
            </View>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  closeButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.PRIMARY,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 20,
    color: Colors.PRIMARY,
  },
  headerSpacer: {
    width: 50,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 20,
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
    textAlign: 'center',
    marginBottom: 20,
  },
  statsContainer: {
    marginBottom: 25,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
    gap: 8,
  },
  typeTag: {
    backgroundColor: '#e9ecef',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  typeText: {
    fontFamily: 'outfit',
    fontSize: 14,
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
});

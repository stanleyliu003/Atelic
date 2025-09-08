import { Colors } from '../../../../constants/Colors';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Activity } from '../../../types/activity.types';
import { formatDistance, formatDuration } from '../../../utils/routeUtils';
import { ActivityImage } from './activity_image';

interface ActivityCardProps {
  activity: Activity;
  style?: any;
  isSelected?: boolean;
  onPress?: (activity: Activity) => void;
  onLongPress?: (activity: Activity) => void;
  showSelectionIndicator?: boolean;
  disabled?: boolean;
  index?: number; // New prop for displaying numbered prefix
  nextActivityDistance?: number; // Distance to next activity in meters
  nextActivityDuration?: string; // Duration to next activity
  isLastActivity?: boolean; // Whether this is the last activity in the list
  nextActivity?: Activity; // Next activity for Google Maps routing
}

export function ActivityCard({ 
  activity, 
  style, 
  isSelected = false,
  onPress,
  onLongPress,
  showSelectionIndicator = false,
  disabled = false,
  index,
  nextActivityDistance,
  nextActivityDuration,
  isLastActivity = false,
  nextActivity
}: ActivityCardProps) {
  
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

  const handleRoutePress = () => {
    if (!nextActivity) return;

    const createCoordinateUrl = () => {
      if (activity.lat && activity.lng && nextActivity.lat && nextActivity.lng) {
        const origin = `${activity.lat},${activity.lng}`;
        const destination = `${nextActivity.lat},${nextActivity.lng}`;
        return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      }
      return null;
    };

    if (activity.name && nextActivity.name) {
      // Use activity names for better user experience
      const origin = encodeURIComponent(activity.name);
      const destination = encodeURIComponent(nextActivity.name);
      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      
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

  // Format the activity name with optional number prefix
  const getDisplayName = () => {
    if (index !== undefined && index >= 0) {
      return `${index + 1}. ${activity.name}`;
    }
    return activity.name;
  };

  return (
    <View style={styles.cardContainer}>
      <View 
        style={[
          styles.activityCard, 
          style,
          isSelected && styles.selectedCard,
          disabled && styles.disabledCard
        ]}
      >
        <View style={styles.activityContent}>
          {showSelectionIndicator && (
            <TouchableOpacity
              style={styles.selectionTouchArea}
              onPress={handlePress}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <View style={[styles.selectionIndicator, isSelected && styles.selectedIndicator]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.cardContentArea}
            onPress={!showSelectionIndicator ? handlePress : undefined}
            onLongPress={handleLongPress}
            disabled={disabled}
            activeOpacity={showSelectionIndicator ? 1 : 0.7}
          >
            <View style={styles.activityInfo}>
              <Text style={[styles.activityText, disabled && styles.disabledText]}>
                {getDisplayName()}
              </Text>
              <View style={styles.activityStats}>
                {activity.rating && (
                  <View style={styles.ratingContainer}>
                    <Text style={[styles.ratingText, disabled && styles.disabledText]}>
                      ⭐ {activity.rating}
                    </Text>
                  </View>
                )}
                {activity.types && activity.types.length > 0 && (
                  <View style={styles.typesContainer}>
                    <Text style={[styles.typesText, disabled && styles.disabledText]}>
                      {activity.types[0].replace(/_/g, ' ')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            <ActivityImage 
              photo_reference={activity.photo_reference || ''} 
              style={[styles.activityImage, disabled && styles.disabledImage]}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Distance and Travel Time Info - Now a button */}
      {!isLastActivity && nextActivityDistance !== undefined && nextActivityDistance !== null && nextActivityDistance > 0 && nextActivityDuration && (
        <TouchableOpacity 
          style={styles.routeInfo}
          onPress={handleRoutePress}
          activeOpacity={0.7}
        >
          <View style={styles.routeInfoItem}>
            <MaterialCommunityIcons name="car-outline" size={17} color={Colors.PRIMARY} />
            <Text style={styles.routeInfoValue}>  {formatDuration(nextActivityDuration)}</Text>
          </View>
          <View style={styles.routeInfoItem}>
            <Text style={styles.routeMidDotLabel}>· </Text>
            <Text style={styles.routeInfoValue}>{formatDistance(nextActivityDistance)}</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={18} color={Colors.PRIMARY} style={styles.chevronIcon} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 18,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCard: {
    backgroundColor: '#f0f8ff', // Light blue background for selected state f0f8ff
    //borderWidth: 1,
    borderColor: Colors.PRIMARY,
  },
  disabledCard: {
    opacity: 0.6,
  },
  activityContent: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContentArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionTouchArea: {
    width: 40,
    height: 40,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicator: {
    width: 16,
    height: 16,
    borderRadius: 7.8,
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
    fontSize: 9.1,
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
    flexWrap: 'wrap',
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
    backgroundColor: '#e9ecef',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  typesText: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: Colors.GRAY,
    textTransform: 'capitalize',
  },
  activityImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  disabledImage: {
    opacity: 0.6,
  },
  routeInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
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
});

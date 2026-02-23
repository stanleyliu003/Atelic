import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Colors } from '../../../constants/Colors';

interface FeedTrip {
  tripId: string;
  tripTitle?: string | null;
  selectedCity?: string | null;
  tripPhotoReference?: string[] | null;
  startDate?: string | null;
  endDate?: string | null;
  tripLength?: number | null;
  createdAt: string;
  updatedAt?: string | null;
  ownerUsername: string | null;
  ownerFullName: string | null;
  ownerProfilePhotoUrl?: string | null;
  isOwnTrip?: boolean;
}

interface FeedTripCardProps {
  trip: FeedTrip;
  onTripPress: (tripId: string) => void;
  onProfilePress: (username: string) => void;
}

const DEFAULT_AVATAR = require('../../../assets/images/default-avatar.png');
const DEFAULT_TRIP_IMAGE = require('../../../assets/images/default_trip.jpg');

export function FeedTripCard({ trip, onTripPress, onProfilePress }: FeedTripCardProps) {
  const formatTripDates = () => {
    if (!trip.startDate && !trip.endDate) return null;

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (trip.startDate && trip.endDate) {
      return `${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}`;
    } else if (trip.startDate) {
      return `Starting ${formatDate(trip.startDate)}`;
    } else if (trip.endDate) {
      return `Until ${formatDate(trip.endDate)}`;
    }
    return null;
  };

  const getTripImage = () => {
    if (trip.tripPhotoReference && trip.tripPhotoReference.length > 0) {
      const photoRef = trip.tripPhotoReference[0];
      if (typeof photoRef === 'string' && photoRef) {
        return { uri: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAP_KEY}` };
      }
    }
    return DEFAULT_TRIP_IMAGE;
  };

  return (
    <View style={styles.card}>
      {/* Owner Header */}
      <TouchableOpacity
        style={styles.ownerHeader}
        onPress={() => trip.ownerUsername && onProfilePress(trip.ownerUsername)}
      >
        <Image
          source={trip.ownerProfilePhotoUrl ? { uri: trip.ownerProfilePhotoUrl } : DEFAULT_AVATAR}
          style={styles.ownerPhoto}
          defaultSource={DEFAULT_AVATAR}
        />
        <View style={styles.ownerInfo}>
          <Text style={styles.ownerName}>{trip.ownerFullName || 'Unknown User'}</Text>
          <Text style={styles.ownerUsername}>@{trip.ownerUsername || 'unknown'}</Text>
        </View>
        {trip.isOwnTrip && (
          <View style={styles.ownTripBadge}>
            <Text style={styles.ownTripText}>Your Trip</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Trip Image */}
      <TouchableOpacity onPress={() => onTripPress(trip.tripId)}>
        <Image
          source={getTripImage()}
          style={styles.tripImage}
          defaultSource={DEFAULT_TRIP_IMAGE}
        />
      </TouchableOpacity>

      {/* Trip Info */}
      <TouchableOpacity style={styles.tripInfo} onPress={() => onTripPress(trip.tripId)}>
        <Text style={styles.tripTitle} numberOfLines={1}>
          {trip.tripTitle || trip.selectedCity || 'Untitled Trip'}
        </Text>
        {trip.selectedCity && trip.tripTitle && (
          <Text style={styles.tripCity} numberOfLines={1}>{trip.selectedCity}</Text>
        )}
        {formatTripDates() && (
          <Text style={styles.tripDates}>{formatTripDates()}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.WHITE,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  ownerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.LIGHT_GRAY,
  },
  ownerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.BLACK,
  },
  ownerUsername: {
    fontSize: 14,
    color: Colors.GRAY,
    marginTop: 2,
  },
  ownTripBadge: {
    backgroundColor: Colors.ORANGE_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ownTripText: {
    fontSize: 12,
    color: Colors.ORANGE,
    fontWeight: '600',
  },
  tripImage: {
    width: '100%',
    height: 250,
    backgroundColor: Colors.LIGHT_GRAY,
  },
  tripInfo: {
    padding: 12,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.BLACK,
    marginBottom: 4,
  },
  tripCity: {
    fontSize: 14,
    color: Colors.GRAY,
    marginBottom: 4,
  },
  tripDates: {
    fontSize: 14,
    color: Colors.DARK_GRAY,
  },
});

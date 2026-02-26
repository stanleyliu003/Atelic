import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { TripCarouselImage } from './TripCarouselImage';
import { useLazyCarousel } from '../../hooks/useLazyCarousel';
import { Colors } from '../../../constants/Colors';

interface TripData {
  tripId: string;
  selectedCity?: string;
  tripPhotoReference?: Array<{
    photo_reference?: string;
    place_id?: string;
  }>;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  tripLength?: number;
}

interface TripCardProps {
  trip: TripData;
  tripKey: string; // Unique key for state tracking (e.g., 'owned-tripId' or 'shared-tripId')
  isLoading: boolean;
  isDeleting: boolean;
  isSelected: boolean;
  onPress: () => void;
  onMenuPress: () => void;
  onPhotoRefUpdate: (tripId: string, index: number, newRef: string | null) => void;
  onPhotoCountUpdate: (key: string, count: number) => void;
  photoCount: number;
  currentCarouselIndex: number;
  onCarouselIndexChange: (key: string, index: number) => void;
}

// Default image for trips without photos
const DEFAULT_TRIP_IMAGE = require('../../../assets/images/default_trip.jpg');

const SCREEN_WIDTH = Dimensions.get('window').width;
// Matches the horizontal padding used around cards in the add-to-trip list
const CARD_HORIZONTAL_PADDING = 40;
const CAROUSEL_WIDTH = SCREEN_WIDTH - CARD_HORIZONTAL_PADDING;

export function TripCard({
  trip,
  tripKey,
  isLoading,
  isDeleting,
  isSelected,
  onPress,
  onMenuPress,
  onPhotoRefUpdate,
  onPhotoCountUpdate,
  photoCount,
  currentCarouselIndex,
  onCarouselIndexChange,
}: TripCardProps) {
  // Lazy loading hook - only load images user has scrolled to
  const { onSnapToItem, shouldLoad } = useLazyCarousel(photoCount);

  const handleSnapToItem = (index: number) => {
    // Update parent's carousel index state
    onCarouselIndexChange(tripKey, index);
    // Update lazy loading state
    onSnapToItem(index);
  };

  const formatDateRange = () => {
    const startDate = trip.startDate ? new Date(trip.startDate) : null;
    const endDate = trip.endDate ? new Date(trip.endDate) : null;

    if (startDate && endDate) {
      const sameMonth =
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getFullYear() === endDate.getFullYear();

      if (sameMonth) {
        // Same month/year: "Jan 15 - 20, 2025"
        const startFormatted = startDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
        const endDay = endDate.getDate();
        const year = endDate.getFullYear();
        return `${startFormatted} - ${endDay}, ${year}`;
      } else if (startDate.getFullYear() === endDate.getFullYear()) {
        // Different month but same year: "Dec 28 - Jan 7, 2026"
        const startFormatted = startDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
        const endFormatted = endDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
        const year = endDate.getFullYear();
        return `${startFormatted} - ${endFormatted}, ${year}`;
      } else {
        // Different month/year: "Dec 28, 2025 - Jan 7, 2026"
        const startFormatted = startDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const endFormatted = endDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        return `${startFormatted} - ${endFormatted}`;
      }
    } else if (startDate) {
      return startDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } else if (endDate) {
      return endDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } else {
      return trip.tripLength != null
        ? `${trip.tripLength} day trip`
        : 'Unknown length';
    }
  };

  // Prepare carousel data
  const carouselData =
    trip.tripPhotoReference && trip.tripPhotoReference.length > 0
      ? trip.tripPhotoReference
      : [{}, {}, {}, {}, {}]; // Default 5 empty objects for Unsplash

  const showPaginationDots =
    !(trip.tripPhotoReference?.length === 1 || photoCount === 1);

  return (
    <View
      style={[
        styles.tripCard,
        isSelected && isLoading && styles.tripCardLoading,
      ]}
    >
      <TouchableOpacity
        style={styles.tripCardMainArea}
        onPress={onPress}
        disabled={isLoading || isDeleting}
        activeOpacity={1}
      >
        <View style={styles.tripCardContent}>
          {trip.selectedCity ? (
            <View style={styles.carouselContainer}>
              <Carousel
                loop={false}
                width={CAROUSEL_WIDTH}
                height={170}
                data={carouselData}
                scrollAnimationDuration={300}
                defaultIndex={0}
                onSnapToItem={handleSnapToItem}
                renderItem={({ item, index }) => (
                  <TripCarouselImage
                    photo_reference={item?.photo_reference}
                    place_id={item?.place_id}
                    cityName={trip.selectedCity}
                    photoIndex={index}
                    style={styles.tripCardImage}
                    shouldLoad={shouldLoad(index)}
                    onPhotoRefUpdate={(newRef) =>
                      onPhotoRefUpdate(trip.tripId, index, newRef)
                    }
                    onPhotoCountUpdate={(count) =>
                      onPhotoCountUpdate(tripKey, count)
                    }
                  />
                )}
              />
              {showPaginationDots && (
                <View style={styles.paginationDots}>
                  {Array.from({ length: photoCount }, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        currentCarouselIndex === index && styles.activeDot,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Image
              source={DEFAULT_TRIP_IMAGE}
              style={styles.tripCardImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.tripCardInfo}>
            <View style={styles.tripCardTitleRow}>
              <Text style={styles.tripCardTitle}>
                {trip.selectedCity || 'Unknown City'}
              </Text>
              {isSelected && isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={Colors.PRIMARY}
                  style={styles.menuButton}
                />
              ) : (
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    onMenuPress();
                  }}
                  disabled={isLoading || isDeleting}
                >
                  <FontAwesome6 name="ellipsis" size={24} color={Colors.GRAY} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.tripCardLength}>{formatDateRange()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tripCard: {
    backgroundColor: Colors.WHITE,
    borderRadius: 12,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  tripCardMainArea: {
    flex: 1,
  },
  tripCardLoading: {
    opacity: 0.7,
  },
  tripCardContent: {
    flexDirection: 'column',
  },
  tripCardImage: {
    width: '100%',
    height: 170,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tripCardInfo: {
    padding: 15,
    alignItems: 'flex-start',
  },
  tripCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  tripCardTitle: {
    fontFamily: 'outfit-medium',
    fontSize: 20,
    color: Colors.PRIMARY,
    flex: 1,
  },
  tripCardLength: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
  },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  carouselContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: Colors.WHITE,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

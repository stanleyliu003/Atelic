import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { TripCarouselImage } from '../profile/TripCarouselImage';
import { useLazyCarousel } from '../../hooks/useLazyCarousel';
import { Colors } from '../../../constants/Colors';

interface CityData {
  city: string;
  country?: string;
  count: number;
}

interface CityCardProps {
  cityData: CityData;
  cardWidth: number;
  imageHeight: number;
  onPress: () => void;
  onPhotoCountUpdate: (city: string, count: number) => void;
  photoCount: number;
  currentCarouselIndex: number;
  onCarouselIndexChange: (city: string, index: number) => void;
}

export function CityCard({
  cityData,
  cardWidth,
  imageHeight,
  onPress,
  onPhotoCountUpdate,
  photoCount,
  currentCarouselIndex,
  onCarouselIndexChange,
}: CityCardProps) {
  // Lazy loading hook - only load images user has scrolled to
  const { onSnapToItem, shouldLoad } = useLazyCarousel(photoCount);

  const handleSnapToItem = (index: number) => {
    // Update parent's carousel index state
    onCarouselIndexChange(cityData.city, index);
    // Update lazy loading state
    onSnapToItem(index);
  };

  const showPaginationDots = photoCount > 1;

  return (
    <TouchableOpacity
      style={[styles.cityCard, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.carouselContainer}>
        <Carousel
          loop={false}
          width={cardWidth}
          height={imageHeight}
          data={[{}, {}, {}, {}, {}]} // Default 5 empty objects for Unsplash
          scrollAnimationDuration={300}
          defaultIndex={0}
          onSnapToItem={handleSnapToItem}
          renderItem={({ index: carouselIndex }) => (
            <TripCarouselImage
              cityName={cityData.city}
              photoIndex={carouselIndex}
              style={[styles.cityCardImage, { height: imageHeight }]}
              shouldLoad={shouldLoad(carouselIndex)}
              onPhotoCountUpdate={(count) =>
                onPhotoCountUpdate(cityData.city, count)
              }
            />
          )}
        />
        {showPaginationDots && (
          <View style={styles.paginationDots}>
            {Array.from({ length: photoCount }, (_, dotIndex) => (
              <View
                key={dotIndex}
                style={[
                  styles.dot,
                  currentCarouselIndex === dotIndex && styles.activeDot,
                ]}
              />
            ))}
          </View>
        )}
      </View>
      <View style={styles.cityCardInfo}>
        <Text style={styles.cityName} numberOfLines={1}>
          {cityData.city}
        </Text>
        <Text style={styles.cityCount}>
          {cityData.count} place{cityData.count !== 1 ? 's' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cityCard: {
    backgroundColor: Colors.WHITE,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  carouselContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cityCardImage: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: Colors.WHITE,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cityCardInfo: {
    padding: 12,
    alignItems: 'flex-start',
  },
  cityName: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 4,
  },
  cityCount: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: Colors.GRAY,
  },
});

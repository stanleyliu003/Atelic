import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { TripCarouselImage } from '../profile/TripCarouselImage';
import { useLazyCarousel } from '../../hooks/useLazyCarousel';
import { Colors } from '../../../constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';

interface CityData {
  city: string;
  country?: string;
  count: number;
  isCountry?: boolean; // When true, this card represents a country group
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
  onDelete: () => void;
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
  onDelete,
}: CityCardProps) {
  const [menuVisible, setMenuVisible] = useState(false);

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
        <View style={styles.cityTextContainer}>
          <Text style={styles.cityName} numberOfLines={1}>
            {cityData.city}
          </Text>
          <Text style={styles.cityCount}>
            {cityData.count} place{cityData.count !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={(e: any) => {
            e?.stopPropagation?.();
            setMenuVisible(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesome6 name="ellipsis" size={18} color={Colors.GRAY} />
        </TouchableOpacity>
      </View>

      {/* Menu Modal - matches profile.jsx design */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.modalSpacer} />
          <TouchableOpacity
            style={styles.menuModal}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setMenuVisible(false)}
              >
                <Ionicons name="close" size={32} color={Colors.GRAY} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  onDelete();
                }}
              >
                <FontAwesome name="trash" size={30} color="#FF4444" />
                <Text style={[styles.menuItemText, { color: '#FF4444' }]}>
                  Delete saved folder
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cityTextContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  menuButton: {
    padding: 4,
    marginTop: -20,
    marginRight: -10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  modalSpacer: {
    flex: 0.67,
  },
  menuModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 0.33,
    paddingTop: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.GRAY,
    borderRadius: 2,
    opacity: 0.3,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginVertical: 4,
  },
  menuItemText: {
    fontFamily: 'outfit-medium',
    fontSize: 20,
    marginLeft: 12,
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

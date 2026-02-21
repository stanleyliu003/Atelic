import React, { useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../constants/Colors';
import { TripCity } from '../../types/city.types';

interface CitySelectorProps {
  cities: TripCity[];
  activeCityId: string | null;
  onCitySelect: (cityId: string) => void;
  onAddCity: () => void;
  onRemoveCity?: (cityId: string) => void;
  canEdit: boolean;
}

function formatShortDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function cityDateLabel(city: TripCity): string | null {
  const start = formatShortDate(city.startDate);
  const end = formatShortDate(city.endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  return null;
}

export function CitySelector({
  cities,
  activeCityId,
  onCitySelect,
  onAddCity,
  onRemoveCity,
  canEdit,
}: CitySelectorProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const wiggleAnim = useRef(new Animated.Value(0)).current;
  const wiggleLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const enterEditMode = () => {
    setIsEditMode(true);
    wiggleLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: -1, duration: 70, useNativeDriver: true }),
      ])
    );
    wiggleLoopRef.current.start();
  };

  const exitEditMode = () => {
    wiggleLoopRef.current?.stop();
    wiggleAnim.setValue(0);
    setIsEditMode(false);
  };

  const handleCityPress = (cityId: string) => {
    if (isEditMode) {
      exitEditMode();
    } else {
      onCitySelect(cityId);
    }
  };

  const handleRemove = (cityId: string) => {
    onRemoveCity?.(cityId);
    // If after removal only one city is left, exit edit mode
    if (cities.length <= 2) {
      exitEditMode();
    }
  };

  const rotation = wiggleAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-2.5deg', '2.5deg'],
  });

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {cities.map((city) => {
          const isActive = city.cityId === activeCityId;
          const dateLabel = cityDateLabel(city);
          const canDelete = canEdit && cities.length > 1;

          return (
            <Animated.View
              key={city.cityId}
              style={isEditMode ? { transform: [{ rotate: rotation }] } : undefined}
            >
              <TouchableOpacity
                style={[styles.cityTab, isActive && !isEditMode && styles.cityTabActive]}
                onPress={() => handleCityPress(city.cityId)}
                onLongPress={canEdit ? enterEditMode : undefined}
                delayLongPress={400}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.cityName, isActive && !isEditMode && styles.cityNameActive]}
                  numberOfLines={1}
                >
                  {city.name}
                </Text>
                {dateLabel ? (
                  <Text
                    style={[styles.cityDate, isActive && !isEditMode && styles.cityDateActive]}
                    numberOfLines={1}
                  >
                    {dateLabel}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* Delete badge — appears in edit mode */}
              {isEditMode && canDelete && (
                <TouchableOpacity
                  style={styles.deleteBadge}
                  onPress={() => handleRemove(city.cityId)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <View style={styles.deleteBadgeInner}>
                    <Ionicons name="remove" size={10} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}
            </Animated.View>
          );
        })}

        {/* Done button — exits edit mode */}
        {isEditMode ? (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={exitEditMode}
            activeOpacity={0.7}
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        ) : (
          canEdit && (
            <TouchableOpacity
              style={styles.addCityButton}
              onPress={onAddCity}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#1976D2" />
              <Text style={styles.addCityText}>Add City</Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.WHITE,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  cityTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cityTabActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
  },
  cityName: {
    fontSize: 13,
    fontFamily: 'outfit-medium',
    color: '#6B7280',
  },
  cityNameActive: {
    color: '#1976D2',
    fontFamily: 'outfit-semibold',
  },
  cityDate: {
    fontSize: 10,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    marginTop: 2,
  },
  cityDateActive: {
    color: '#42A5F5',
  },
  deleteBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    zIndex: 10,
  },
  deleteBadgeInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  doneButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 13,
    fontFamily: 'outfit-semibold',
    color: '#fff',
  },
  addCityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#90CAF9',
    borderStyle: 'dashed',
  },
  addCityText: {
    fontSize: 13,
    fontFamily: 'outfit-medium',
    color: '#1976D2',
  },
});

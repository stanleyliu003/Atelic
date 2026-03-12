import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { Activity, EnhancedRouteLeg } from '../../types/activity.types';
import { getMarkerColor } from '../../constants/mapColors';
import { formatDistance } from '../../utils/routeUtils';

interface DaySummaryCardProps {
  dayNumber: number;
  activities: Activity[];
  date: Date | null;
  onPress: () => void;
  routeLegs?: EnhancedRouteLeg[];
  activityNumberOffset?: number; // Offset for sequential numbering across days in Overview
}

export default function DaySummaryCard({
  dayNumber,
  activities,
  date,
  onPress,
  routeLegs,
  activityNumberOffset = 0, // Default 0 for backward compatibility
}: DaySummaryCardProps) {
  const formatDate = (date: Date | null): string => {
    if (!date) return '';

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayNumber = date.getDate();

    // Add ordinal suffix (st, nd, rd, th)
    const getOrdinalSuffix = (day: number): string => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    return `${monthName} ${dayNumber}${getOrdinalSuffix(dayNumber)}, ${dayName}`;
  };

  const formatTime = (time?: string): string => {
    if (!time) return '';
    const [hour, minute] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${minute} ${ampm}`;
  };

  // Calculate distance between two coordinates in miles (fallback if no API data)
  const calculateDistanceHaversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistanceMiles = (miles: number): string => {
    if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
    if (miles < 1) return `${miles.toFixed(1)} mi`;
    return `${miles.toFixed(1)} mi`;
  };

  const dayColor = getMarkerColor(`day${dayNumber}` as any);

  // Refined monotone palette for clean, stylish aesthetic
  const monotoneGray = '#6E7787';
  const monotoneBorder = '#DCE0E5';
  const monotoneConnector = '#E8EAED';

  const scaleValue = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = React.useState(false);

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.spring(scaleValue, {
      toValue: 0.995,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <Pressable
        style={[styles.card, isPressed && styles.cardPressed]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dayBadge}>
            <View style={[styles.dayDot, { backgroundColor: dayColor }]} />
            <Text style={styles.dayTitle}>Day {dayNumber}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </View>

        {date && <Text style={styles.date}>{formatDate(date)}</Text>}

        {/* Timeline */}
        {activities.length > 0 ? (
          <View style={styles.timeline}>
            {activities.map((activity, index) => {
              const isHotel = activity.isLodging === true || activity.primaryType === 'lodging';
              const isLast = index === activities.length - 1;

              // Calculate activity number for Overview - sequential across all days
              // Count non-hotel activities from start up to current activity, then add offset
              const activityNumberWithinDay = activities
                .slice(0, index + 1)
                .filter(a => !(a.isLodging === true || a.primaryType === 'lodging'))
                .length;
              const activityNumber = activityNumberOffset + activityNumberWithinDay;

              // Get distance to next activity
              let distance: string | null = null;
              if (!isLast) {
                // Try to get distance from API route data first
                if (routeLegs && routeLegs[index]) {
                  const leg = routeLegs[index];
                  const modeData = leg.modeData[leg.selectedMode];
                  if (modeData?.distance) {
                    // formatDistance from routeUtils expects meters
                    distance = formatDistance(modeData.distance);
                  }
                }

                // Fallback to Haversine calculation if no API data
                if (!distance && activity.lat && activity.lng) {
                  const nextActivity = activities[index + 1];
                  if (nextActivity?.lat && nextActivity?.lng) {
                    const miles = calculateDistanceHaversine(
                      activity.lat,
                      activity.lng,
                      nextActivity.lat,
                      nextActivity.lng
                    );
                    distance = formatDistanceMiles(miles);
                  }
                }
              }

              return (
                <View key={`day${dayNumber}-${index}-${activity.instanceId || activity.place_id || 'no-id'}`} style={styles.timelineItem}>
                  {/* Time Column */}
                  <View style={styles.timeColumn}>
                    {activity.startTime && (
                      <Text style={styles.timeText}>{formatTime(activity.startTime)}</Text>
                    )}
                  </View>

                  {/* Marker Column */}
                  <View style={styles.markerColumn}>
                    <View style={[
                      styles.marker,
                      isHotel && styles.markerHotel,
                      { borderColor: isHotel ? '#DDD6FE' : monotoneBorder }
                    ]}>
                      {isHotel ? (
                        <MaterialIcons name="bed" size={10} color="#6366F1" />
                      ) : (
                        <Text style={[styles.markerNumber, { color: monotoneGray }]}>{activityNumber}</Text>
                      )}
                    </View>
                    {!isLast && <View style={[styles.connector, { backgroundColor: monotoneConnector }]} />}
                  </View>

                  {/* Activity Column */}
                  <View style={styles.activityColumn}>
                    <Text style={styles.activityName} numberOfLines={1}>
                      {activity.name}
                    </Text>
                    {!isLast && distance && (
                      <View style={styles.metaRow}>
                        <Text style={styles.distanceInline}>
                          {distance}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>No activities planned</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  cardPressed: {
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayTitle: {
    fontSize: 15,
    fontFamily: 'outfit-bold',
    color: '#111827',
    letterSpacing: -0.4,
  },
  date: {
    fontSize: 11.5,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    marginBottom: 3,
    marginLeft: 15,
    letterSpacing: -0.1,
  },
  timeline: {
    gap: 0,
    marginTop: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 26,
  },
  timeColumn: {
    width: 54,
    paddingTop: 0.5,
    marginLeft: 15,
  },
  timeText: {
    fontSize: 10.5,
    fontFamily: 'outfit-medium',
    color: '#A8B0BA',
    letterSpacing: -0.2,
  },
  markerColumn: {
    width: 22,
    alignItems: 'center',
    position: 'relative',
    marginRight: 10,
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FAFBFC',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  markerHotel: {
    backgroundColor: '#F7F8FA',
  },
  markerNumber: {
    fontSize: 9.5,
    fontFamily: 'outfit-bold',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  connector: {
    position: 'absolute',
    top: 22,
    bottom: -26,
    width: 1.5,
    left: 10.25,
    zIndex: 1,
    opacity: 0.3,
  },
  activityColumn: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 1,
  },
  activityName: {
    fontSize: 13.5,
    fontFamily: 'outfit-semibold',
    color: '#1F2937',
    lineHeight: 16,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  durationText: {
    fontSize: 10.5,
    fontFamily: 'outfit',
    color: '#A8B0BA',
  },
  distanceInline: {
    fontSize: 10.5,
    fontFamily: 'outfit',
    color: '#B0B7C3',
    letterSpacing: -0.1,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

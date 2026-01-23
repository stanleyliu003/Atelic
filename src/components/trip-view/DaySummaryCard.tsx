import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
}

export default function DaySummaryCard({
  dayNumber,
  activities,
  date,
  onPress,
  routeLegs,
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

  const scaleValue = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = React.useState(false);

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.spring(scaleValue, {
      toValue: 0.985,
      friction: 10,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 10,
      tension: 100,
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
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </View>

        {date && <Text style={styles.date}>{formatDate(date)}</Text>}

        {/* Timeline */}
        {activities.length > 0 ? (
          <View style={styles.timeline}>
            {activities.map((activity, index) => {
              const isHotel = activity.isLodging === true || activity.primaryType === 'lodging';
              const isLast = index === activities.length - 1;

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
                <View key={activity.instanceId || index} style={styles.timelineItem}>
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
                      { borderColor: dayColor }
                    ]}>
                      {isHotel ? (
                        <Ionicons name="home" size={11} color={dayColor} />
                      ) : (
                        <Text style={[styles.markerNumber, { color: dayColor }]}>{index + 1}</Text>
                      )}
                    </View>
                    {!isLast && <View style={[styles.connector, { backgroundColor: dayColor }]} />}
                  </View>

                  {/* Activity Column */}
                  <View style={styles.activityColumn}>
                    <Text style={styles.activityName} numberOfLines={1}>
                      {activity.name}
                    </Text>
                    {(activity.endTime || (!isLast && distance)) && (
                      <View style={styles.metaRow}>
                        {activity.endTime && (
                          <Text style={styles.durationText}>
                            Until {formatTime(activity.endTime)}
                          </Text>
                        )}
                        {!isLast && distance && (
                          <Text style={styles.distanceInline}>
                            {activity.endTime ? ' · ' : ''}{distance}
                          </Text>
                        )}
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  cardPressed: {
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dayDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dayTitle: {
    fontSize: 15,
    fontFamily: 'outfit-bold',
    color: '#111827',
    letterSpacing: -0.3,
  },
  date: {
    fontSize: 12,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    marginBottom: 10,
    marginLeft: 1,
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 36,
  },
  timeColumn: {
    width: 56,
    paddingTop: 1,
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'outfit-semibold',
    color: '#9CA3AF',
    letterSpacing: -0.1,
  },
  markerColumn: {
    width: 26,
    alignItems: 'center',
    position: 'relative',
    marginRight: 10,
  },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  markerHotel: {
    backgroundColor: '#F9FAFB',
  },
  markerNumber: {
    fontSize: 11,
    fontFamily: 'outfit-bold',
    fontWeight: 'bold',
  },
  connector: {
    position: 'absolute',
    top: 26,
    bottom: -36,
    width: 2,
    left: 12,
    zIndex: 1,
    opacity: 0.2,
  },
  activityColumn: {
    flex: 1,
    paddingTop: 1,
    paddingBottom: 10,
  },
  activityName: {
    fontSize: 14,
    fontFamily: 'outfit-semibold',
    color: '#111827',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  durationText: {
    fontSize: 11,
    fontFamily: 'outfit',
    color: '#9CA3AF',
  },
  distanceInline: {
    fontSize: 11,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    letterSpacing: 0,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

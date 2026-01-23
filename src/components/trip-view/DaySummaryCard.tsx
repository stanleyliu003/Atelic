import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { Activity } from '../../types/activity.types';
import { getMarkerColor } from '../../constants/mapColors';

interface DaySummaryCardProps {
  dayNumber: number;
  activities: Activity[];
  date: Date | null;
  onPress: () => void;
}

export default function DaySummaryCard({
  dayNumber,
  activities,
  date,
  onPress,
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

  const dayColor = getMarkerColor(`day${dayNumber}` as any);

  const scaleValue = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = React.useState(false);

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.spring(scaleValue, {
      toValue: 0.98,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 8,
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
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>

        {date && <Text style={styles.date}>{formatDate(date)}</Text>}

        {/* Timeline */}
        {activities.length > 0 ? (
          <View style={styles.timeline}>
            {activities.map((activity, index) => {
              const isHotel = activity.isLodging === true || activity.primaryType === 'lodging';
              const isLast = index === activities.length - 1;

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
                    <View style={[styles.marker, isHotel && styles.markerHotel, { borderColor: dayColor }]}>
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
                    <Text style={styles.activityName} numberOfLines={2}>
                      {activity.name}
                    </Text>
                    {activity.endTime && (
                      <Text style={styles.durationText}>
                        Until {formatTime(activity.endTime)}
                      </Text>
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
    paddingVertical: 14,
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayTitle: {
    fontSize: 14,
    fontFamily: 'outfit-bold',
    color: '#111827',
    letterSpacing: -0.2,
  },
  date: {
    fontSize: 12,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    marginBottom: 12,
    marginLeft: 1,
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 38,
  },
  timeColumn: {
    width: 56,
    paddingTop: 2,
  },
  timeText: {
    fontSize: 10,
    fontFamily: 'outfit-semibold',
    color: '#9CA3AF',
    letterSpacing: -0.1,
  },
  markerColumn: {
    width: 28,
    alignItems: 'center',
    position: 'relative',
    marginRight: 6,
  },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
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
    top: 24,
    bottom: -38,
    width: 2,
    left: 11,
    zIndex: 1,
    opacity: 0.25,
  },
  activityColumn: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 12,
    paddingLeft: 4,
  },
  activityName: {
    fontSize: 13,
    fontFamily: 'outfit-semibold',
    color: '#111827',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  durationText: {
    fontSize: 11,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'outfit',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

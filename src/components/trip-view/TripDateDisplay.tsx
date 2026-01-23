import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';

interface TripDateDisplayProps {
  startDate: string | null;
  endDate: string | null;
  tripLength: number;
  onPress: () => void;
  editable: boolean;
}

export default function TripDateDisplay({
  startDate,
  endDate,
  tripLength,
  onPress,
  editable,
}: TripDateDisplayProps) {
  const formatSmartDateRange = (start: Date, end: Date): string => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const startMonth = months[start.getMonth()];
    const endMonth = months[end.getMonth()];
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    // Same month and year: "Jan 15-20, 2026"
    if (startMonth === endMonth && startYear === endYear) {
      return `${startMonth} ${startDay}-${endDay}, ${startYear}`;
    }

    // Same year, different months: "Jan 28 - Feb 3, 2026"
    if (startYear === endYear) {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
    }

    // Different years: "Dec 28, 2025 - Jan 3, 2026"
    return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
  };

  const formatDateRange = (): string => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return formatSmartDateRange(start, end);
    }
    return `${tripLength} ${tripLength === 1 ? 'day' : 'days'}`;
  };

  return (
    <Pressable
      onPress={editable ? onPress : undefined}
      style={[styles.container, !editable && styles.disabled]}
      disabled={!editable}
    >
      <View style={styles.contentContainer}>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={Colors.PRIMARY}
          style={styles.icon}
        />
        <Text style={styles.dateText}>{formatDateRange()}</Text>
        {editable && (
          <Ionicons
            name="chevron-down"
            size={18}
            color={Colors.GRAY}
            style={styles.chevronIcon}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  disabled: {
    opacity: 0.7,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  dateText: {
    fontSize: 16,
    fontFamily: 'outfit-semibold',
    color: '#1E293B',
    flex: 1,
  },
  chevronIcon: {
    marginLeft: 4,
    opacity: 0.5,
  },
});

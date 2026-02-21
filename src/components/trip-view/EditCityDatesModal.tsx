import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CalendarPicker from 'react-native-calendar-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../constants/Colors';
import { TripCity } from '../../types/city.types';

// One distinct color per "other" city — used for the underline indicator on the calendar
const CITY_INDICATOR_COLORS = ['#FF8A65', '#4CAF50', '#AB47BC', '#FF7043', '#26A69A', '#F9A825'];

/** Returns every Date in [startIso, endIso] inclusive. */
function datesInRange(startIso: string | null | undefined, endIso: string | null | undefined): Date[] {
  if (!startIso) return [];
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

interface EditCityDatesModalProps {
  visible: boolean;
  city: TripCity | null;
  /** All OTHER cities (not the one being edited) */
  otherCities: TripCity[];
  onClose: () => void;
  onSave: (cityId: string, startDate: string | null, endDate: string | null) => void;
}

export function EditCityDatesModal({
  visible,
  city,
  otherCities,
  onClose,
  onSave,
}: EditCityDatesModalProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Sync local state whenever the city changes
  useEffect(() => {
    setStartDate(city?.startDate ? new Date(city.startDate) : null);
    setEndDate(city?.endDate ? new Date(city.endDate) : null);
  }, [city?.cityId]);

  if (!city) return null;

  const handleDateChange = (date: Date, type: 'START_DATE' | 'END_DATE') => {
    if (type === 'START_DATE') {
      setStartDate(date);
      setEndDate(null);
    } else {
      setEndDate(date);
    }
  };

  const handleSave = () => {
    onSave(
      city.cityId,
      startDate ? startDate.toISOString() : null,
      endDate ? endDate.toISOString() : null,
    );
    onClose();
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const formatDate = (d: Date | null) => {
    if (!d) return null;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Build customDatesStyles: colored bottom-border underline for each other city's range.
  // containerStyle goes on the dayWrapper and is NOT overridden by CalendarPicker selection logic.
  const otherCitiesWithDates = otherCities.filter(c => c.startDate || c.endDate);
  const customDatesStyles = otherCitiesWithDates.flatMap((c, idx) => {
    const color = CITY_INDICATOR_COLORS[idx % CITY_INDICATOR_COLORS.length];
    return datesInRange(c.startDate, c.endDate).map(d => ({
      date: d,
      containerStyle: {
        borderBottomWidth: 3,
        borderBottomColor: color,
        borderRadius: 0,
      },
    }));
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Edit Dates</Text>
              <Text style={styles.cityName}>{city.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Current selection summary */}
          <View style={styles.datesSummary}>
            <Ionicons name="calendar-outline" size={15} color="#6B7280" />
            <Text style={styles.datesSummaryText}>
              {startDate && endDate
                ? `${formatDate(startDate)} → ${formatDate(endDate)}`
                : startDate
                ? `${formatDate(startDate)} → pick end date`
                : 'Select a start date'}
            </Text>
            {(startDate || endDate) && (
              <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Calendar — customDatesStyles adds a colored underline for each other city */}
          <View style={styles.calendarWrapper}>
            <CalendarPicker
              startFromMonday
              allowRangeSelection
              onDateChange={handleDateChange}
              selectedStartDate={startDate}
              selectedEndDate={endDate}
              selectedRangeStyle={{ backgroundColor: '#E3F2FD' }}
              selectedDayColor="#1976D2"
              selectedDayTextColor="#fff"
              todayBackgroundColor="transparent"
              todayTextStyle={{ color: '#1976D2', fontWeight: '600' }}
              textStyle={{ fontFamily: 'outfit', fontSize: 13 }}
              customDatesStyles={customDatesStyles}
              width={320}
            />
          </View>

          {/* Legend — shows which color belongs to which other city */}
          {otherCitiesWithDates.length > 0 && (
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>Other cities on this trip:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.legendScroll}
              >
                {otherCitiesWithDates.map((c, idx) => (
                  <View key={c.cityId} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendSwatch,
                        { backgroundColor: CITY_INDICATOR_COLORS[idx % CITY_INDICATOR_COLORS.length] },
                      ]}
                    />
                    <Text style={styles.legendText} numberOfLines={1}>{c.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Save */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Dates</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 44,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: 'outfit-semibold',
    color: '#111827',
  },
  cityName: {
    fontSize: 13,
    fontFamily: 'outfit',
    color: '#6B7280',
    marginTop: 2,
  },
  datesSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  datesSummaryText: {
    flex: 1,
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#374151',
  },
  clearText: {
    fontFamily: 'outfit-medium',
    fontSize: 13,
    color: '#EF4444',
  },
  calendarWrapper: {
    alignItems: 'center',
    marginBottom: 10,
  },
  legend: {
    marginBottom: 14,
  },
  legendTitle: {
    fontSize: 11,
    fontFamily: 'outfit-medium',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  legendScroll: {
    gap: 14,
    paddingRight: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'outfit-medium',
    color: '#374151',
    maxWidth: 100,
  },
  saveButton: {
    backgroundColor: '#1976D2',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'outfit-semibold',
  },
});

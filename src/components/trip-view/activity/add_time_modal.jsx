import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable
} from 'react-native';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];
const ITEM_HEIGHT = 40;

function TimePickerColumn({ values, selectedValue, onValueChange, debugLabel, visible, enableWrap = true }) {
  const scrollViewRef = useRef(null);

  const handleScrollEnd = (event) => {
    const offset = event.nativeEvent.contentOffset.y;
    // The middle row is at offset ITEM_HEIGHT (accounting for top spacer/wrap item)
    // Calculate which index corresponds to the middle visible row
    const index = Math.round(offset / ITEM_HEIGHT);
    const selectedIndex = Math.min(Math.max(index, 0), values.length - 1);

    onValueChange(values[selectedIndex]);
    // Snap to position where selected item is in the middle row
    scrollViewRef.current?.scrollTo({
      y: selectedIndex * ITEM_HEIGHT,
      animated: true,
    });
  };

  useEffect(() => {
    if (!visible) return;

    const index = values.indexOf(selectedValue);
    if (index >= 0 && scrollViewRef.current) {
      // Use setTimeout to ensure the ScrollView is fully mounted
      // Scroll so the selected value appears in the middle row
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: index * ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    }
  }, [selectedValue, values, visible, enableWrap]);

  return (
    <View style={styles.pickerColumn}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
      >
        {enableWrap ? (
          <>
            {/* Show last value above the first (for wrapping effect) */}
            <View style={styles.pickerItem}>
              <Text style={styles.pickerText}>{values[values.length - 1]}</Text>
            </View>

            {values.map((value) => (
              <View key={value} style={styles.pickerItem}>
                <Text style={styles.pickerText}>{value}</Text>
              </View>
            ))}

            {/* Show first value below the last (for wrapping effect) */}
            <View style={styles.pickerItem}>
              <Text style={styles.pickerText}>{values[0]}</Text>
            </View>
          </>
        ) : (
          <>
            {/* Top spacer for non-wrapping columns */}
            <View style={styles.pickerSpacer} />

            {values.map((value) => (
              <View key={value} style={styles.pickerItem}>
                <Text style={styles.pickerText}>{value}</Text>
              </View>
            ))}

            {/* Bottom spacer for non-wrapping columns */}
            <View style={styles.pickerSpacer} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default function AddTimeModal({ visible, onClose, initialStartTime, initialEndTime, onSave }) {
  // Convert 24-hour time to 12-hour format with AM/PM
  const parseTime = (time, fallback = '09:00') => {
    const effectiveTime = time || fallback;
    const [hour24, minute] = effectiveTime.split(':');
    const hourNum = parseInt(hour24, 10);
    const isPM = hourNum >= 12;
    const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return {
      hour: String(hour12),
      minute: minute.padStart(2, '0'),
      period: isPM ? 'PM' : 'AM'
    };
  };

  // Convert 12-hour time with period to total minutes for comparison
  const toMinutes = (hour, minute, period) => {
    let hour24 = parseInt(hour, 10);
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    return hour24 * 60 + parseInt(minute, 10);
  };

  // Convert total minutes to 12-hour format with period
  const minutesToTime = (totalMinutes) => {
    const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
    const hour24 = Math.floor(clamped / 60);
    const minute = clamped % 60;
    const isPM = hour24 >= 12;
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    return {
      hour: String(hour12),
      minute: String(minute).padStart(2, '0'),
      period: isPM ? 'PM' : 'AM'
    };
  };

  // Convert 12-hour format back to 24-hour for saving
  const to24Hour = (hour, minute, period) => {
    let hour24 = parseInt(hour, 10);
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    return `${String(hour24).padStart(2, '0')}:${minute}`;
  };

  // Initial times: default 09:00 → 10:00, but honor any existing activity times
  const startParsed = parseTime(initialStartTime, '09:00');
  let initialEndParsed;
  if (initialEndTime) {
    // If the activity already has an end time, use it as-is (we'll still enforce ordering in the effect below)
    initialEndParsed = parseTime(initialEndTime, '10:00');
  } else {
    // No stored end time – default to one hour after the (possibly stored) start time
    const startMinutes = toMinutes(startParsed.hour, startParsed.minute, startParsed.period);
    initialEndParsed = minutesToTime(startMinutes + 60);
  }

  const [startHour, setStartHour] = useState(startParsed.hour);
  const [startMinute, setStartMinute] = useState(startParsed.minute);
  const [startPeriod, setStartPeriod] = useState(startParsed.period);
  const [endHour, setEndHour] = useState(initialEndParsed.hour);
  const [endMinute, setEndMinute] = useState(initialEndParsed.minute);
  const [endPeriod, setEndPeriod] = useState(initialEndParsed.period);

  // Whenever the modal is (re)opened, scroll to the correct default or stored times
  useEffect(() => {
    if (!visible) return;

    // Recompute start based on latest props:
    // - If activity has a stored startTime, use it
    // - Otherwise default to 09:00
    const recomputedStart = parseTime(initialStartTime, '09:00');

    // Recompute end:
    // - If activity has a stored endTime, use it
    // - Otherwise default to one hour after the (possibly stored) start time
    let recomputedEnd;
    if (initialEndTime) {
      recomputedEnd = parseTime(initialEndTime, '10:00');
    } else {
      const startMinutes = toMinutes(recomputedStart.hour, recomputedStart.minute, recomputedStart.period);
      recomputedEnd = minutesToTime(startMinutes + 60);
    }

    setStartHour(recomputedStart.hour);
    setStartMinute(recomputedStart.minute);
    setStartPeriod(recomputedStart.period);
    setEndHour(recomputedEnd.hour);
    setEndMinute(recomputedEnd.minute);
    setEndPeriod(recomputedEnd.period);
  }, [visible, initialStartTime, initialEndTime]);

  // Ensure end time is always after start time and auto-save on valid change
  useEffect(() => {
    const startTotal = toMinutes(startHour, startMinute, startPeriod);
    const endTotal = toMinutes(endHour, endMinute, endPeriod);

    if (endTotal <= startTotal) {
      const adjusted = minutesToTime(startTotal + 60);

      if (adjusted.hour !== endHour) {
        setEndHour(adjusted.hour);
      }
      if (adjusted.minute !== endMinute) {
        setEndMinute(adjusted.minute);
      }
      if (adjusted.period !== endPeriod) {
        setEndPeriod(adjusted.period);
      }
      return;
    }

    if (visible) {
      const startTime24 = to24Hour(startHour, startMinute, startPeriod);
      const endTime24 = to24Hour(endHour, endMinute, endPeriod);
      onSave(startTime24, endTime24);
    }
  }, [startHour, startMinute, startPeriod, endHour, endMinute, endPeriod, visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlayWrapper}>
      {/* Backdrop overlay */}
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      />
      {/* Popover container */}
      <View style={styles.popoverContainer}>
        <View style={styles.timePickerContainer}>
          {/* Start Time */}
          <View style={styles.timeSection}>
            <Text style={styles.timeSectionTitle}>Start</Text>
            <View style={styles.pickerRowContainer}>
              <View style={styles.rowSelectionIndicator} />
              <View style={styles.pickerRow}>
                <TimePickerColumn
                  values={HOURS}
                  selectedValue={startHour}
                  onValueChange={setStartHour}
                  debugLabel="start-hour"
                  visible={visible}
                />
                <TimePickerColumn
                  values={MINUTES}
                  selectedValue={startMinute}
                  onValueChange={setStartMinute}
                  debugLabel="start-minute"
                  visible={visible}
                />
                <TimePickerColumn
                  values={PERIODS}
                  selectedValue={startPeriod}
                  onValueChange={setStartPeriod}
                  debugLabel="start-period"
                  visible={visible}
                  enableWrap={false}
                />
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* End Time */}
          <View style={styles.timeSection}>
            <Text style={styles.timeSectionTitle}>End</Text>
            <View style={styles.pickerRowContainer}>
              <View style={styles.rowSelectionIndicator} />
              <View style={styles.pickerRow}>
                <TimePickerColumn
                  values={HOURS}
                  selectedValue={endHour}
                  onValueChange={setEndHour}
                  debugLabel="end-hour"
                  visible={visible}
                />
                <TimePickerColumn
                  values={MINUTES}
                  selectedValue={endMinute}
                  onValueChange={setEndMinute}
                  debugLabel="end-minute"
                  visible={visible}
                />
                <TimePickerColumn
                  values={PERIODS}
                  selectedValue={endPeriod}
                  onValueChange={setEndPeriod}
                  debugLabel="end-period"
                  visible={visible}
                  enableWrap={false}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  popoverContainer: {
    position: 'absolute',
    bottom: 60,
    left: -60,
    right: 0,
    marginHorizontal: 60,
    backgroundColor: '#000',
    borderRadius: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
    zIndex: 10,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 5,
  },
  timeSection: {
    flex: 1,
    alignItems: 'center',
  },
  timeSectionTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // Container for hour, minute, and period columns so the highlight spans the full row
  pickerRowContainer: {
    height: ITEM_HEIGHT * 3,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  pickerColumn: {
    height: ITEM_HEIGHT * 3,
    width: 35,
    overflow: 'hidden',
  },
  pickerSpacer: {
    height: ITEM_HEIGHT,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: '#fff',
  },
  // Highlight the currently selected time across the whole row
  rowSelectionIndicator: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    pointerEvents: 'none',
  },
  divider: {
    width: 1,
    backgroundColor: '#444',
    marginHorizontal: 8,
  },
});

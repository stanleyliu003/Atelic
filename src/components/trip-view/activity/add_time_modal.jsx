import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable
} from 'react-native';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ITEM_HEIGHT = 40;

function TimePickerColumn({ values, selectedValue, onValueChange, debugLabel, visible }) {
  const scrollViewRef = useRef(null);

  const handleScrollEnd = (event) => {
    const offset = event.nativeEvent.contentOffset.y;
    const index = Math.round(offset / ITEM_HEIGHT);
    const selectedIndex = Math.min(Math.max(index, 0), values.length - 1);

    onValueChange(values[selectedIndex]);
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
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: index * ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    }
  }, [selectedValue, values, visible]);

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
        {/* Top spacer so the first real value can sit in the middle highlighted row */}
        <View style={styles.pickerSpacer} />

        {values.map((value) => (
          <View key={value} style={styles.pickerItem}>
            <Text style={styles.pickerText}>{value}</Text>
          </View>
        ))}

        {/* Bottom spacer so the last real value can also sit in the middle row */}
        <View style={styles.pickerSpacer} />
      </ScrollView>
    </View>
  );
}

export default function AddTimeModal({ visible, onClose, initialStartTime, initialEndTime, onSave }) {
  const parseTime = (time, fallback = '09:00') => {
    const effectiveTime = time || fallback;
    const [hour, minute] = effectiveTime.split(':');
    return { hour: hour.padStart(2, '0'), minute: minute.padStart(2, '0') };
  };

  const toMinutes = (hour, minute) => parseInt(hour, 10) * 60 + parseInt(minute, 10);

  const minutesToTime = (totalMinutes) => {
    const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
    const hour = String(Math.floor(clamped / 60)).padStart(2, '0');
    const minute = String(clamped % 60).padStart(2, '0');
    return { hour, minute };
  };

  // Initial times: default 09:00 → 10:00, but honor any existing activity times
  const startParsed = parseTime(initialStartTime, '09:00');
  let initialEndParsed;
  if (initialEndTime) {
    // If the activity already has an end time, use it as-is (we'll still enforce ordering in the effect below)
    initialEndParsed = parseTime(initialEndTime, '10:00');
  } else {
    // No stored end time – default to one hour after the (possibly stored) start time
    const startMinutes = toMinutes(startParsed.hour, startParsed.minute);
    initialEndParsed = minutesToTime(startMinutes + 60);
  }

  const [startHour, setStartHour] = useState(startParsed.hour);
  const [startMinute, setStartMinute] = useState(startParsed.minute);
  const [endHour, setEndHour] = useState(initialEndParsed.hour);
  const [endMinute, setEndMinute] = useState(initialEndParsed.minute);

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
      const startMinutes = toMinutes(recomputedStart.hour, recomputedStart.minute);
      recomputedEnd = minutesToTime(startMinutes + 60);
    }

    setStartHour(recomputedStart.hour);
    setStartMinute(recomputedStart.minute);
    setEndHour(recomputedEnd.hour);
    setEndMinute(recomputedEnd.minute);
  }, [visible, initialStartTime, initialEndTime]);

  // Ensure end time is always after start time and auto-save on valid change
  useEffect(() => {
    const startTotal = toMinutes(startHour, startMinute);
    const endTotal = toMinutes(endHour, endMinute);

    if (endTotal <= startTotal) {
      const adjusted = minutesToTime(startTotal + 60);

      if (adjusted.hour !== endHour) {
        setEndHour(adjusted.hour);
      }
      if (adjusted.minute !== endMinute) {
        setEndMinute(adjusted.minute);
      }
      return;
    }

    if (visible) {
      onSave(`${startHour}:${startMinute}`, `${endHour}:${endMinute}`);
    }
  }, [startHour, startMinute, endHour, endMinute, visible]);

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
    left: 0,
    width: '70%',
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
  // Container for both hour and minute columns so the highlight spans the full row
  pickerRowContainer: {
    height: ITEM_HEIGHT * 3,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  pickerColumn: {
    height: ITEM_HEIGHT * 3,
    width: 45,
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

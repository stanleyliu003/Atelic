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

function TimePickerColumn({ values, selectedValue, onValueChange, debugLabel, visible, enableWrap = true, disabled = false }) {
  const scrollViewRef = useRef(null);
  const LOOP_MULTIPLIER = 3; // repeat list; we will keep the scroll position in the middle copy
  const loopEnabled = enableWrap && Array.isArray(values) && values.length > 0;
  const loopedValues = loopEnabled ? Array.from({ length: LOOP_MULTIPLIER }, () => values).flat() : values;

  const handleScrollEnd = (event) => {
    if (disabled) return; // Don't handle scroll for viewers

    const offset = event.nativeEvent.contentOffset.y;
    // The middle row is at offset ITEM_HEIGHT (because we render one extra item above)
    // Calculate which "raw" index corresponds to the selected value.
    const rawIndex = Math.round(offset / ITEM_HEIGHT);

    if (loopEnabled) {
      const baseLen = values.length;
      const selectedBaseIndex = ((rawIndex % baseLen) + baseLen) % baseLen;
      const selected = values[selectedBaseIndex];

      onValueChange(selected);

      // Re-center into the middle copy so the user can keep scrolling "forever"
      const middleStart = baseLen; // start index of the 2nd copy
      const targetRawIndex = middleStart + selectedBaseIndex;
      scrollViewRef.current?.scrollTo({
        y: targetRawIndex * ITEM_HEIGHT,
        animated: false,
      });
      return;
    }

    const selectedIndex = Math.min(Math.max(rawIndex, 0), values.length - 1);
    onValueChange(values[selectedIndex]);
    scrollViewRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: true });
  };

  useEffect(() => {
    if (!visible) return;

    const index = values.indexOf(selectedValue);
    if (index >= 0 && scrollViewRef.current) {
      // Use setTimeout to ensure the ScrollView is fully mounted
      // Scroll so the selected value appears in the middle row
      setTimeout(() => {
        const y = loopEnabled ? (values.length + index) * ITEM_HEIGHT : index * ITEM_HEIGHT;
        scrollViewRef.current?.scrollTo({
          y,
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
        scrollEnabled={!disabled}
      >
        {loopEnabled ? (
          <>
            {/* Show last value above the first (for wrapping effect) */}
            <View style={styles.pickerItem}>
              <Text style={styles.pickerText}>{values[values.length - 1]}</Text>
            </View>

            {loopedValues.map((value, idx) => (
              <View key={`${debugLabel || 'col'}-${value}-${idx}`} style={styles.pickerItem}>
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

export default function AddTimeModal({ visible, onClose, initialStartTime, initialEndTime, onSave, currentUserRole }) {
  const isViewer = currentUserRole === 'viewer';
  const didUserInteractRef = useRef(false);
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

  const markInteracted = () => {
    didUserInteractRef.current = true;
  };

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

    // Reset interaction tracking each time the modal opens so we only enforce ordering
    // after the user finishes scrolling.
    didUserInteractRef.current = false;
  }, [visible, initialStartTime, initialEndTime]);

  // After the user finishes scrolling, ensure end time is after start time.
  // If not, bump end time to 1 hour after start time, then auto-save.
  useEffect(() => {
    if (!visible || isViewer) return;
    if (!didUserInteractRef.current) return;

    const startTotal = toMinutes(startHour, startMinute, startPeriod);
    const endTotal = toMinutes(endHour, endMinute, endPeriod);

    if (endTotal <= startTotal) {
      const adjusted = minutesToTime(startTotal + 60);
      if (adjusted.hour !== endHour) setEndHour(adjusted.hour);
      if (adjusted.minute !== endMinute) setEndMinute(adjusted.minute);
      if (adjusted.period !== endPeriod) setEndPeriod(adjusted.period);
      return;
    }

    const startTime24 = to24Hour(startHour, startMinute, startPeriod);
    const endTime24 = to24Hour(endHour, endMinute, endPeriod);
    onSave(startTime24, endTime24);
  }, [startHour, startMinute, startPeriod, endHour, endMinute, endPeriod, visible, isViewer]);

  if (!visible) return null;

  return (
    <View style={styles.overlayWrapper}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      />
      <View style={styles.popoverContainer}>
        {/* Header labels */}
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>Start</Text>
          <Text style={styles.headerLabel}>End</Text>
        </View>

        <View style={styles.timePickerContainer}>
          {/* Start Time */}
          <View style={styles.timeSection}>
            <View style={styles.pickerRowContainer}>
              <View style={styles.rowSelectionIndicator} />
              <View style={styles.pickerRow}>
                <TimePickerColumn
                  values={HOURS}
                  selectedValue={startHour}
                  onValueChange={(v) => {
                    markInteracted();
                    setStartHour(v);
                  }}
                  debugLabel="start-hour"
                  visible={visible}
                  disabled={isViewer}
                />
                <Text style={styles.colonSeparator}>:</Text>
                <TimePickerColumn
                  values={MINUTES}
                  selectedValue={startMinute}
                  onValueChange={(v) => {
                    markInteracted();
                    setStartMinute(v);
                  }}
                  debugLabel="start-minute"
                  visible={visible}
                  disabled={isViewer}
                />
                <TimePickerColumn
                  values={PERIODS}
                  selectedValue={startPeriod}
                  onValueChange={(v) => {
                    markInteracted();
                    setStartPeriod(v);
                  }}
                  debugLabel="start-period"
                  visible={visible}
                  enableWrap={false}
                  disabled={isViewer}
                />
              </View>
            </View>
          </View>

          {/* Arrow separator */}
          <Text style={styles.arrowSeparator}>→</Text>

          {/* End Time */}
          <View style={styles.timeSection}>
            <View style={styles.pickerRowContainer}>
              <View style={styles.rowSelectionIndicator} />
              <View style={styles.pickerRow}>
                <TimePickerColumn
                  values={HOURS}
                  selectedValue={endHour}
                  onValueChange={(v) => {
                    markInteracted();
                    setEndHour(v);
                  }}
                  debugLabel="end-hour"
                  visible={visible}
                  disabled={isViewer}
                />
                <Text style={styles.colonSeparator}>:</Text>
                <TimePickerColumn
                  values={MINUTES}
                  selectedValue={endMinute}
                  onValueChange={(v) => {
                    markInteracted();
                    setEndMinute(v);
                  }}
                  debugLabel="end-minute"
                  visible={visible}
                  disabled={isViewer}
                />
                <TimePickerColumn
                  values={PERIODS}
                  selectedValue={endPeriod}
                  onValueChange={(v) => {
                    markInteracted();
                    setEndPeriod(v);
                  }}
                  debugLabel="end-period"
                  visible={visible}
                  enableWrap={false}
                  disabled={isViewer}
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
    bottom: 52,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  headerLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSection: {
    flex: 1,
    alignItems: 'center',
  },
  arrowSeparator: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#52525B',
    marginHorizontal: 4,
  },
  colonSeparator: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: '#71717A',
    marginHorizontal: -2,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pickerRowContainer: {
    height: ITEM_HEIGHT * 3,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  pickerColumn: {
    height: ITEM_HEIGHT * 3,
    width: 34,
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
    fontSize: 17,
    color: '#E4E4E7',
  },
  rowSelectionIndicator: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    pointerEvents: 'none',
  },
});

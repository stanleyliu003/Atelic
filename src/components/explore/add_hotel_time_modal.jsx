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
    if (disabled) return; // Don't handle scroll for disabled state

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

export default function AddHotelTimeModal({ visible, onClose, initialTime, onSave, buttonLayout = null }) {
  const didUserInteractRef = useRef(false);

  // Convert 24-hour time to 12-hour format with AM/PM
  const parseTime = (time, fallback = '15:00') => {
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

  // Convert 12-hour format back to 24-hour for saving
  const to24Hour = (hour, minute, period) => {
    let hour24 = parseInt(hour, 10);
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    return `${String(hour24).padStart(2, '0')}:${minute}`;
  };

  // Initial time parsing
  const timeParsed = parseTime(initialTime);

  const [hour, setHour] = useState(timeParsed.hour);
  const [minute, setMinute] = useState(timeParsed.minute);
  const [period, setPeriod] = useState(timeParsed.period);

  const markInteracted = () => {
    didUserInteractRef.current = true;
  };

  // Whenever the modal is (re)opened, scroll to the correct default or stored time
  useEffect(() => {
    if (!visible) return;

    const recomputedTime = parseTime(initialTime);
    setHour(recomputedTime.hour);
    setMinute(recomputedTime.minute);
    setPeriod(recomputedTime.period);

    // Reset interaction tracking each time the modal opens
    didUserInteractRef.current = false;
  }, [visible, initialTime]);

  // Auto-save when user finishes scrolling
  useEffect(() => {
    if (!visible) return;
    if (!didUserInteractRef.current) return;

    const time24 = to24Hour(hour, minute, period);
    onSave(time24);
  }, [hour, minute, period, visible]);

  if (!visible) return null;

  // Calculate position based on button layout
  const getPopoverStyle = () => {
    if (!buttonLayout) {
      return styles.popoverContainer;
    }

    return {
      ...styles.popoverContainer,
      top: buttonLayout.y + buttonLayout.height + 8, // 8px below the button
      left: buttonLayout.x,
      right: undefined,
      marginHorizontal: 0,
    };
  };

  return (
    <View style={styles.overlayWrapper}>
      {/* Backdrop overlay */}
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      />
      {/* Popover container */}
      <View style={getPopoverStyle()}>
        <View style={styles.timePickerContainer}>
          {/* Single Time Column */}
          <View style={styles.timeSection}>
            <View style={styles.pickerRowContainer}>
              <View style={styles.rowSelectionIndicator} />
              <View style={styles.pickerRow}>
                <TimePickerColumn
                  values={HOURS}
                  selectedValue={hour}
                  onValueChange={(v) => {
                    markInteracted();
                    setHour(v);
                  }}
                  debugLabel="hour"
                  visible={visible}
                />
                <TimePickerColumn
                  values={MINUTES}
                  selectedValue={minute}
                  onValueChange={(v) => {
                    markInteracted();
                    setMinute(v);
                  }}
                  debugLabel="minute"
                  visible={visible}
                />
                <TimePickerColumn
                  values={PERIODS}
                  selectedValue={period}
                  onValueChange={(v) => {
                    markInteracted();
                    setPeriod(v);
                  }}
                  debugLabel="period"
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
    backgroundColor: '#000',
    borderRadius: 20,
    padding: 15,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
    zIndex: 10,
    alignSelf: 'flex-start',
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  timeSection: {
    alignItems: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // Container for hour, minute, and period columns so the highlight spans the full row
  pickerRowContainer: {
    height: ITEM_HEIGHT * 3,
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
});

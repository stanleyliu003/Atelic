import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions
} from 'react-native';
import { Colors } from '../../../../constants/Colors';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ITEM_HEIGHT = 40;

function TimePickerColumn({ values, selectedValue, onValueChange }) {
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
    const index = values.indexOf(selectedValue);
    if (index >= 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: index * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, []);

  return (
    <View style={styles.pickerColumn}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={{ height: ITEM_HEIGHT }} />
        {values.map((value) => (
          <View key={value} style={styles.pickerItem}>
            <Text style={styles.pickerText}>
              {value}
            </Text>
          </View>
        ))}
        <View style={{ height: ITEM_HEIGHT }} />
      </ScrollView>
      <View style={styles.selectionIndicator} />
    </View>
  );
}

export default function AddTimeModal({ visible, onClose, initialStartTime, initialEndTime, onSave }) {
  const parseTime = (time) => {
    if (!time) return { hour: '09', minute: '00' };
    const [hour, minute] = time.split(':');
    return { hour: hour.padStart(2, '0'), minute: minute.padStart(2, '0') };
  };

  const startParsed = parseTime(initialStartTime);
  const endParsed = parseTime(initialEndTime);

  const [startHour, setStartHour] = useState(startParsed.hour);
  const [startMinute, setStartMinute] = useState(startParsed.minute);
  const [endHour, setEndHour] = useState(endParsed.hour);
  const [endMinute, setEndMinute] = useState(endParsed.minute);

  const handleSave = () => {
    onSave(`${startHour}:${startMinute}`, `${endHour}:${endMinute}`);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalContainer}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.timePickerContainer}>
            {/* Start Time */}
            <View style={styles.timeSection}>
              <Text style={styles.timeSectionTitle}>Start Time</Text>
              <View style={styles.pickerRow}>
                <TimePickerColumn
                  values={HOURS}
                  selectedValue={startHour}
                  onValueChange={setStartHour}
                />
                <Text style={styles.colon}>:</Text>
                <TimePickerColumn
                  values={MINUTES}
                  selectedValue={startMinute}
                  onValueChange={setStartMinute}
                />
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* End Time */}
            <View style={styles.timeSection}>
              <Text style={styles.timeSectionTitle}>End Time</Text>
              <View style={styles.pickerRow}>
                <TimePickerColumn
                  values={HOURS}
                  selectedValue={endHour}
                  onValueChange={setEndHour}
                />
                <Text style={styles.colon}>:</Text>
                <TimePickerColumn
                  values={MINUTES}
                  selectedValue={endMinute}
                  onValueChange={setEndMinute}
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: Dimensions.get('window').width * 0.85,
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeSection: {
    flex: 1,
    alignItems: 'center',
  },
  timeSectionTitle: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: 'white',
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerColumn: {
    height: ITEM_HEIGHT * 3,
    width: 50,
    position: 'relative',
  },
  scrollContent: {
    paddingVertical: 0,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerText: {
    fontFamily: 'outfit',
    fontSize: 18,
    color: '#666',
  },
  selectionIndicator: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    pointerEvents: 'none',
  },
  colon: {
    fontFamily: 'outfit-medium',
    fontSize: 22,
    color: 'white',
    marginHorizontal: 5,
  },
  divider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 10,
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: 'white',
  },
});

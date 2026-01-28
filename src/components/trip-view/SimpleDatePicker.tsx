import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CalendarPicker from 'react-native-calendar-picker';
import { Colors } from '../../../constants/Colors';

interface SimpleDatePickerProps {
  visible: boolean;
  onClose: () => void;
  initialStartDate: string | null;
  initialEndDate: string | null;
  initialTripLength: number;
  onSave: (startDate: string | null, endDate: string | null, tripLength: number) => void;
}

export default function SimpleDatePicker({
  visible,
  onClose,
  initialStartDate,
  initialEndDate,
  initialTripLength,
  onSave,
}: SimpleDatePickerProps) {
  const [isFlexibleDays, setIsFlexibleDays] = useState(!initialStartDate);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(
    initialStartDate ? new Date(initialStartDate) : null
  );
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(
    initialEndDate ? new Date(initialEndDate) : null
  );
  const [flexibleDays, setFlexibleDays] = useState(initialTripLength || 1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Pan responder for swipe-down gesture to close modal
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 50 pixels, close the modal
        if (gestureState.dy > 50) {
          onClose();
        }
      },
    })
  ).current;

  // Reset state when modal opens with new initial values
  useEffect(() => {
    if (visible) {
      setIsFlexibleDays(!initialStartDate);
      setSelectedStartDate(initialStartDate ? new Date(initialStartDate) : null);
      setSelectedEndDate(initialEndDate ? new Date(initialEndDate) : null);
      setFlexibleDays(initialTripLength || 1);
      setIsDropdownOpen(false);
    }
  }, [visible, initialStartDate, initialEndDate, initialTripLength]);

  const handleDateChange = (date: Date, type: string) => {
    console.log('[SimpleDatePicker] Date selected:', date, 'type:', type);

    if (type === 'END_DATE') {
      if (!date) {
        setSelectedEndDate(null);
        return;
      }

      if (selectedStartDate) {
        const timeDiff = date.getTime() - selectedStartDate.getTime();

        if (timeDiff < 0) {
          // Swap dates if end is before start
          setSelectedStartDate(date);
          setSelectedEndDate(selectedStartDate);
        } else {
          setSelectedEndDate(date);
        }
      }
    } else {
      // START_DATE
      setSelectedStartDate(date);
      setSelectedEndDate(null);
    }
  };

  const handleSave = () => {
    if (isFlexibleDays) {
      onSave(null, null, flexibleDays);
    } else {
      if (selectedStartDate && selectedEndDate) {
        const start = new Date(selectedStartDate);
        const end = new Date(selectedEndDate);
        const timeDiff = end.getTime() - start.getTime();
        const tripLength = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
        onSave(selectedStartDate.toISOString(), selectedEndDate.toISOString(), tripLength);
      }
    }
    onClose();
  };

  const isConfirmEnabled = isFlexibleDays
    ? flexibleDays > 0
    : selectedStartDate && selectedEndDate;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop - tap to close */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.modalContainer}>
          {/* Handle - swipeable to close */}
          <View {...panResponder.panHandlers} style={styles.modalHandleContainer}>
            <View style={styles.modalHandle} />
          </View>

          {/* Header with Toggle Only */}
          <View style={styles.header}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Flexible days</Text>
              <Switch
                value={isFlexibleDays}
                onValueChange={setIsFlexibleDays}
                trackColor={{ false: '#D1D5DB', true: '#FFA53F' }}
                thumbColor={isFlexibleDays ? '#FFFFFF' : '#f4f3f4'}
                ios_backgroundColor="#D1D5DB"
              />
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {!isFlexibleDays ? (
              // Calendar View
              <View style={styles.calendarContainer}>
            <CalendarPicker
              startFromMonday={false}
              allowRangeSelection={true}
              minDate={new Date(new Date().setHours(0, 0, 0, 0))}
              maxDate={new Date(new Date().setFullYear(new Date().getFullYear() + 3))}
              todayBackgroundColor="#E3F2FD"
              todayTextStyle={{ color: '#27BFFF', fontFamily: 'outfit-semibold' }}
              selectedDayColor="#FFA53F"
              selectedDayTextColor="#FFFFFF"
              selectedRangeStartStyle={{
                backgroundColor: '#FFA53F',
              }}
              selectedRangeEndStyle={{
                backgroundColor: '#FFA53F',
              }}
              selectedRangeStyle={{
                backgroundColor: '#FFA53F',
              }}
              selectedStartDate={selectedStartDate}
              selectedEndDate={selectedEndDate}
              enableSwipe={true}
              weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
              allowBackwardRangeSelect={true}
              onDateChange={handleDateChange}
              width={Dimensions.get('window').width - 80}
              textStyle={{
                fontFamily: 'outfit',
                fontSize: 16,
                color: '#1a1a1a',
              }}
              dayLabelsWrapper={{
                borderTopWidth: 0,
                borderBottomWidth: 0,
                paddingTop: 20,
                paddingBottom: 20,
              }}
              customDayHeaderStyles={() => ({
                textStyle: {
                  fontFamily: 'outfit-semibold',
                  fontSize: 16,
                  color: '#1a1a1a',
                },
              })}
              monthTitleStyle={{
                fontFamily: 'outfit-bold',
                fontSize: 26,
                color: '#1a1a1a',
                marginBottom: 10,
              }}
              yearTitleStyle={{
                fontFamily: 'outfit-bold',
                fontSize: 26,
                color: '#1a1a1a',
                marginBottom: 10,
              }}
              previousComponent={
                <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
              }
              nextComponent={
                <Ionicons name="chevron-forward" size={28} color="#1a1a1a" />
              }
            />
          </View>
            ) : (
              // Flexible Days Picker
              <View style={styles.flexibleDaysContainer}>
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <View style={styles.dropdownContent}>
                      <MaterialCommunityIcons
                        name="calendar-clock-outline"
                        size={24}
                        color="black"
                      />
                      <Text style={styles.dropdownButtonText}>
                        {flexibleDays} day{flexibleDays > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.dropdownArrow, isDropdownOpen && styles.dropdownArrowOpen]}>
                      ▼
                    </Text>
                  </TouchableOpacity>

                  {isDropdownOpen && (
                    <View style={styles.dropdownList}>
                      <ScrollView style={styles.optionsList} nestedScrollEnabled>
                        {Array.from({ length: 30 }, (_, i) => i + 1).map((day, index, array) => (
                          <TouchableOpacity
                            key={day}
                            style={[
                              styles.option,
                              flexibleDays === day && styles.selectedOption,
                              index === array.length - 1 && { borderBottomWidth: 0 },
                            ]}
                            onPress={() => {
                              setFlexibleDays(day);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.optionText,
                                flexibleDays === day && styles.selectedOptionText,
                              ]}
                            >
                              {day} day{day > 1 ? 's' : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Confirm Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                !isConfirmEnabled && styles.confirmButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!isConfirmEnabled}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingBottom: 25,
    maxHeight: '75%',
  },
  modalHandleContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'column',
    marginBottom: 0,
    marginTop: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: -4,
  },
  toggleLabel: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#666666',
  },
  content: {
    maxHeight: 380,
  },
  contentContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  calendarContainer: {
    minHeight: 340,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
  },
  flexibleDaysContainer: {
    minHeight: 340,
    justifyContent: 'flex-start',
    paddingTop: 40,
    paddingBottom: 20,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 0,
    borderRadius: 15,
    backgroundColor: '#F9FAFB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownButtonText: {
    fontFamily: 'outfit-semibold',
    fontSize: 17,
    color: '#1a1a1a',
  },
  dropdownArrow: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#666',
    transform: [{ rotate: '0deg' }],
  },
  dropdownArrowOpen: {
    transform: [{ rotate: '180deg' }],
  },
  dropdownList: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 0,
    borderRadius: 15,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 1001,
    overflow: 'hidden',
  },
  optionsList: {
    maxHeight: 180,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  selectedOption: {
    backgroundColor: '#FFF7ED',
  },
  optionText: {
    fontFamily: 'outfit',
    fontSize: 17,
    color: '#374151',
    textAlign: 'center',
  },
  selectedOptionText: {
    fontFamily: 'outfit-bold',
    color: '#F36406',
  },
  footer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: -20,
  },
  confirmButton: {
    backgroundColor: '#F36406',
    borderRadius: 30,
    paddingVertical: 18,
    marginTop: 20,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontFamily: 'outfit-bold',
    fontSize: 20,
    letterSpacing: 0.3,
  },
});

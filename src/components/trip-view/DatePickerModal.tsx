import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CalendarPicker from 'react-native-calendar-picker';
import { Colors } from '../../../constants/Colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  initialStartDate: string | null;
  initialEndDate: string | null;
  initialTripLength: number;
  onSave: (startDate: string | null, endDate: string | null, tripLength: number) => void;
}

export default function DatePickerModal({
  visible,
  onClose,
  initialStartDate,
  initialEndDate,
  initialTripLength,
  onSave,
}: DatePickerModalProps) {
  const [isFlexibleDays, setIsFlexibleDays] = useState(!initialStartDate);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(
    initialStartDate ? new Date(initialStartDate) : null
  );
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(
    initialEndDate ? new Date(initialEndDate) : null
  );
  const [flexibleDays, setFlexibleDays] = useState(initialTripLength || 1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Animation
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10; // Only respond to downward swipes
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    console.log('[DatePickerModal] Visible changed:', visible);
    console.log('[DatePickerModal] isFlexibleDays:', isFlexibleDays);
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const calculateDayDifference = (start: Date | null, end: Date | null): number => {
    if (!start || !end) return 0;
    const timeDiff = end.getTime() - start.getTime();
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleSave = () => {
    if (isFlexibleDays) {
      onSave(null, null, flexibleDays);
    } else {
      if (selectedStartDate && selectedEndDate) {
        onSave(
          selectedStartDate.toISOString(),
          selectedEndDate.toISOString(),
          calculateDayDifference(selectedStartDate, selectedEndDate)
        );
      }
    }
    handleClose();
  };

  const handleDateChange = (date: Date, type: string) => {
    console.log('[DatePickerModal] Date changed:', date, 'type:', type);
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

  const isConfirmEnabled = isFlexibleDays
    ? flexibleDays > 0
    : selectedStartDate && selectedEndDate;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Trip Dates</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.BLACK} />
            </TouchableOpacity>
          </View>

          {/* Toggle Switch */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Calendar</Text>
            <Switch
              value={isFlexibleDays}
              onValueChange={setIsFlexibleDays}
              trackColor={{ false: '#D1D5DB', true: '#FFA53F' }}
              thumbColor={isFlexibleDays ? '#FFFFFF' : '#f4f3f4'}
            />
            <Text style={styles.toggleLabel}>Flexible Days</Text>
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
                  todayBackgroundColor="#E8F4FD"
                  todayTextStyle={{ color: '#27BFFF' }}
                  selectedDayColor="#FFA53F"
                  selectedDayTextColor="#FFFFFF"
                  selectedStartDate={selectedStartDate}
                  selectedEndDate={selectedEndDate}
                  onDateChange={handleDateChange}
                  enableSwipe={true}
                  weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
                  allowBackwardRangeSelect={true}
                  width={Dimensions.get('window').width - 60}
                  textStyle={{
                    fontFamily: 'outfit',
                    fontSize: 16,
                  }}
                  monthTitleStyle={{
                    fontFamily: 'outfit-bold',
                    fontSize: 24,
                    color: '#1a1a1a',
                  }}
                  yearTitleStyle={{
                    fontFamily: 'outfit-bold',
                    fontSize: 24,
                    color: '#1a1a1a',
                  }}
                  dayLabelsWrapper={{
                    borderTopWidth: 0,
                    borderBottomWidth: 0,
                  }}
                  previousComponent={
                    <Ionicons name="chevron-back" size={24} color="#666666" />
                  }
                  nextComponent={
                    <Ionicons name="chevron-forward" size={24} color="#666666" />
                  }
                />
              </View>
            ) : (
              // Flexible Days Dropdown
              <View style={styles.flexibleDaysContainer}>
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
                    <Ionicons
                      name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color="#666"
                    />
                  </View>
                </TouchableOpacity>

                {isDropdownOpen && (
                  <ScrollView style={styles.dropdown} nestedScrollEnabled>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dropdownItem,
                          flexibleDays === day && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setFlexibleDays(day);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            flexibleDays === day && styles.dropdownItemTextSelected,
                          ]}
                        >
                          {day} day{day > 1 ? 's' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
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
        </Animated.View>
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
    backgroundColor: Colors.WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'outfit-semibold',
    color: Colors.BLACK,
  },
  closeButton: {
    padding: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontFamily: 'outfit-medium',
    color: Colors.BLACK,
    marginHorizontal: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  calendarContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
    minHeight: 400,
  },
  flexibleDaysContainer: {
    paddingVertical: 20,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    fontSize: 16,
    fontFamily: 'outfit',
    color: Colors.BLACK,
    flex: 1,
    marginLeft: 12,
  },
  dropdown: {
    maxHeight: 300,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF7ED',
  },
  dropdownItemText: {
    fontSize: 16,
    fontFamily: 'outfit',
    color: Colors.BLACK,
  },
  dropdownItemTextSelected: {
    fontFamily: 'outfit-semibold',
    color: Colors.PRIMARY,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  confirmButton: {
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: 'outfit-semibold',
    color: Colors.WHITE,
  },
});

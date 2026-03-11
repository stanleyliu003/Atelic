import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Keyboard
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Colors } from '../../../../constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCreateTrip } from '../../../../context/CreateTripContext';
import { Auth } from 'aws-amplify';
import { saveOperation } from '../../../services/tripOperationsService';
import AddTimeModal from './add_time_modal';

// Helper function to convert 24-hour time to 12-hour format with AM/PM
const format12Hour = (time24) => {
  if (!time24) return '';
  const [hourStr, minute] = time24.split(':');
  const hour24 = parseInt(hourStr, 10);
  const isPM = hour24 >= 12;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return `${hour12}:${minute} ${isPM ? 'PM' : 'AM'}`;
};

export function AddNotesModal({ visible, onClose, activity, activeTab, currentUserRole, hotelTimeMode }) {
  const { updateActivityNotes, tripId } = useCreateTrip();
  const [notes, setNotes] = useState(activity.notes || '');
  const isWishlist = activeTab === 'wishlist';
  const [startTime, setStartTime] = useState(activity.startTime || '');
  const [endTime, setEndTime] = useState(activity.endTime || '');

  // For hotel cards: single time instead of range
  const isHotelTime = !!hotelTimeMode;
  const hotelTimeField = hotelTimeMode === 'checkout' ? 'checkOut' : 'checkIn';
  const hotelTimeLabel = hotelTimeMode === 'checkout' ? 'Check-out time' : hotelTimeMode === 'checkin' ? 'Check-in time' : 'Time';
  const [hotelTime, setHotelTime] = useState(
    hotelTimeMode === 'checkout' ? (activity.lodgingTime?.checkOut || '11:00') :
    hotelTimeMode === 'checkin' ? (activity.lodgingTime?.checkIn || '15:00') : ''
  );
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const notesInputRef = useRef(null);
  const isViewer = currentUserRole === 'viewer';

  // Sync local state with activity prop changes (from TripOperations updates)
  useEffect(() => {
    setNotes(activity.notes || '');
    setStartTime(activity.startTime || '');
    setEndTime(activity.endTime || '');
    if (hotelTimeMode === 'checkout') {
      setHotelTime(activity.lodgingTime?.checkOut || '11:00');
    } else if (hotelTimeMode === 'checkin') {
      setHotelTime(activity.lodgingTime?.checkIn || '15:00');
    }
  }, [activity.notes, activity.startTime, activity.endTime, activity.lodgingTime]);

  // Track keyboard visibility
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Close time modal whenever notes modal opens
  useEffect(() => {
    if (visible) {
      setTimeModalVisible(false);
    }
  }, [visible]);

  // Blur the notes input when time modal opens
  useEffect(() => {
    if (timeModalVisible) {
      notesInputRef.current?.blur();
    }
  }, [timeModalVisible]);

  // Build updates object, including hotel time if applicable
  const buildUpdates = () => {
    const updates = {
      notes: notes.trim(),
      startTime,
      endTime,
    };
    if (isHotelTime) {
      updates.lodgingTime = {
        ...(activity.lodgingTime || {}),
        [hotelTimeField]: hotelTime,
      };
    }
    return updates;
  };

  const hasChanges = () => {
    const prevNotes = activity.notes || '';
    const prevStartTime = activity.startTime || '';
    const prevEndTime = activity.endTime || '';
    let changed = prevNotes !== notes.trim() ||
      prevStartTime !== startTime ||
      prevEndTime !== endTime;
    if (isHotelTime) {
      const prevHotelTime = hotelTimeMode === 'checkout'
        ? (activity.lodgingTime?.checkOut || '11:00')
        : (activity.lodgingTime?.checkIn || '15:00');
      changed = changed || prevHotelTime !== hotelTime;
    }
    return changed;
  };

  const handleSave = () => {
    if (!isViewer && hasChanges()) {
      const updates = buildUpdates();
      updateActivityNotes(activity.instanceId, updates);
      trackModifyOperation(activity, activeTab, updates).catch((err) => {
        console.error('[AddNotesModal] Failed to save modify operation:', err);
      });
    }
    onClose();
  };

  const handleClose = () => {
    if (!isViewer && hasChanges()) {
      const updates = buildUpdates();
      updateActivityNotes(activity.instanceId, updates);
      trackModifyOperation(activity, activeTab, updates).catch((err) => {
        console.error('[AddNotesModal] Failed to save modify operation:', err);
      });
    }
    onClose();
  };

  const handleTimeUpdate = (start, end) => {
    setStartTime(start);
    setEndTime(end);
  };

  const trackModifyOperation = async (activity, activeTabValue, updates) => {
    try {
      // Require tripId and instanceId to track operation
      if (!tripId || !activity?.instanceId) {
        return;
      }

      const user = await Auth.currentAuthenticatedUser();
      const userId = user.attributes?.sub || user.username;

      // Determine target and dayNumber from activeTab
      let target = 'wishlist';
      let dayNumber = undefined;

      if (activeTabValue && typeof activeTabValue === 'string' && activeTabValue.startsWith('day')) {
        target = 'day';
        const parsed = parseInt(activeTabValue.replace('day', ''), 10);
        if (!isNaN(parsed)) {
          dayNumber = parsed;
        }
      }

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);

      const operation = {
        tripID: tripId,
        timestamp,
        opId: `${userId}_modify_${target}_${dayNumber || 'none'}_${timestamp}_${random}`,
        userId,
        sequenceNumber: 0,
        type: 'modify',
        target,
        dayNumber,
        data: {
          instanceId: activity.instanceId,
          updates: {
            ...updates,
            lastModified: timestamp,
            modifiedBy: userId,
          },
          lastModified: timestamp,
        },
        applied: false,
      };

      await saveOperation(operation);
    } catch (error) {
      console.error('[AddNotesModal] Error creating modify operation:', error);
    }
  };

  // Swipe down gesture to close
  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      // If swiped down more than 100px with sufficient velocity, close the modal
      if (event.translationY > 100 && event.velocityY > 0) {
        runOnJS(handleClose)();
      }
    });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
          />
          <GestureHandlerRootView
            style={[styles.modalContent, isKeyboardVisible && styles.modalContentExpanded]}
            pointerEvents="auto"
          >
            {/* Drag Indicator */}
            <GestureDetector gesture={swipeGesture}>
              <View style={styles.dragIndicatorContainer}>
                <View style={styles.dragIndicator} />
              </View>
            </GestureDetector>

            {/* Header */}
            <Pressable style={styles.header} onPress={() => setTimeModalVisible(false)}>
              <View style={styles.headerLeft}>
                <Text style={styles.placeName} numberOfLines={1}>
                  {activity.name}
                </Text>
              </View>
              <TouchableOpacity style={styles.doneBtn} onPress={handleSave}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </Pressable>

            {/* Time Button */}
            <View style={styles.timePickerWrapper} pointerEvents="box-none">
              {isHotelTime ? (
                /* Hotel: single time picker for check-in or check-out */
                <View style={styles.timeButtonRow}>
                  <TouchableOpacity
                    style={[styles.addTimeButton, hotelTime && styles.hotelTimeButtonActive]}
                    onPress={() => setTimeModalVisible(true)}
                    pointerEvents="auto"
                    disabled={isViewer}
                  >
                    <MaterialIcons name="schedule" size={15} color={hotelTime ? '#6366F1' : '#A1A1AA'} />
                    <Text style={[styles.addTimeText, hotelTime && styles.hotelTimeTextActive]}>
                      {hotelTime ? `${hotelTimeLabel} · ${format12Hour(hotelTime)}` : hotelTimeLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Regular activity: time range */
                <View style={styles.timeButtonRow}>
                  <TouchableOpacity
                    style={[styles.addTimeButton, startTime && endTime && styles.addTimeButtonActive]}
                    onPress={() => setTimeModalVisible(true)}
                    pointerEvents="auto"
                    disabled={isViewer}
                  >
                    <MaterialIcons name="schedule" size={15} color={startTime && endTime ? '#3B82F6' : '#A1A1AA'} />
                    <Text style={[styles.addTimeText, startTime && endTime && styles.addTimeTextActive]}>
                      {startTime && endTime ? `${format12Hour(startTime)} – ${format12Hour(endTime)}` : 'Add time'}
                    </Text>
                  </TouchableOpacity>

                  {startTime && endTime && !isViewer && (
                    <TouchableOpacity
                      style={styles.clearTimeButton}
                      onPress={() => {
                        setTimeModalVisible(false);
                        setStartTime('');
                        setEndTime('');
                      }}
                      pointerEvents="auto"
                    >
                      <MaterialIcons name="close" size={14} color="#A1A1AA" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {!isViewer && !isHotelTime && (
                <AddTimeModal
                  visible={timeModalVisible}
                  onClose={() => setTimeModalVisible(false)}
                  initialStartTime={startTime}
                  initialEndTime={endTime}
                  onSave={handleTimeUpdate}
                  currentUserRole={currentUserRole}
                />
              )}
              {!isViewer && isHotelTime && (
                <AddTimeModal
                  visible={timeModalVisible}
                  onClose={() => setTimeModalVisible(false)}
                  initialStartTime={hotelTime}
                  initialEndTime={''}
                  onSave={(time) => setHotelTime(time)}
                  currentUserRole={currentUserRole}
                  singleTimeMode={true}
                  singleTimeLabel={hotelTimeLabel}
                />
              )}
            </View>

            {/* Notes Input */}
            <Pressable style={styles.notesInputContainer} onPress={() => setTimeModalVisible(false)}>
              <ScrollView
                contentContainerStyle={styles.notesScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  ref={notesInputRef}
                  style={styles.notesInput}
                  placeholder={isViewer ? 'No notes yet' : 'Write a note...'}
                  placeholderTextColor="#D4D4D8"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={() => setTimeModalVisible(false)}
                  textAlignVertical="top"
                  editable={!isViewer}
                />
              </ScrollView>
            </Pressable>
          </GestureHandlerRootView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    height: '45%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalContentExpanded: {
    height: '72%',
  },
  dragIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  placeName: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  doneBtn: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  doneBtnText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  timePickerWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  timeButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    gap: 6,
  },
  addTimeButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  hotelTimeButtonActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  addTimeText: {
    fontFamily: 'outfit-medium',
    fontSize: 13,
    color: '#A1A1AA',
  },
  addTimeTextActive: {
    color: '#3B82F6',
  },
  hotelTimeTextActive: {
    color: '#6366F1',
  },
  clearTimeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInputContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 14,
  },
  notesScrollContent: {
    flexGrow: 1,
  },
  notesInput: {
    fontFamily: 'outfit',
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
});

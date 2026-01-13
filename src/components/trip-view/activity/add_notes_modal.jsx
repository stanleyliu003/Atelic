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

export function AddNotesModal({ visible, onClose, activity, activeTab, currentUserRole }) {
  const { updateActivityNotes, tripId } = useCreateTrip();
  const [notes, setNotes] = useState(activity.notes || '');
  const isWishlist = activeTab === 'wishlist';
  const [startTime, setStartTime] = useState(activity.startTime || '');
  const [endTime, setEndTime] = useState(activity.endTime || '');
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const notesInputRef = useRef(null);
  const isViewer = currentUserRole === 'viewer';

  // Sync local state with activity prop changes (from TripOperations updates)
  useEffect(() => {
    setNotes(activity.notes || '');
    setStartTime(activity.startTime || '');
    setEndTime(activity.endTime || '');
  }, [activity.notes, activity.startTime, activity.endTime]);

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

  const handleSave = () => {
    // Only save if user is not a viewer
    if (!isViewer) {
      const nextNotes = notes.trim();
      const nextStartTime = startTime;
      const nextEndTime = endTime;

      const prevNotes = activity.notes || '';
      const prevStartTime = activity.startTime || '';
      const prevEndTime = activity.endTime || '';

      const hasChanged =
        prevNotes !== nextNotes ||
        prevStartTime !== nextStartTime ||
        prevEndTime !== nextEndTime;

      if (hasChanged) {
        const updates = {
          notes: nextNotes,
          startTime: nextStartTime,
          endTime: nextEndTime,
        };

        // Update local state
        updateActivityNotes(activity.instanceId, updates);

        // Track as OperationModify for real-time sync
        trackModifyOperation(activity, activeTab, updates).catch((err) => {
          console.error('[AddNotesModal] Failed to save modify operation:', err);
        });
      }
    }
    onClose();
  };

  const handleClose = () => {
    // Only save changes when closing via backdrop if user is not a viewer
    if (!isViewer) {
      const nextNotes = notes.trim();
      const nextStartTime = startTime;
      const nextEndTime = endTime;

      const prevNotes = activity.notes || '';
      const prevStartTime = activity.startTime || '';
      const prevEndTime = activity.endTime || '';

      const hasChanged =
        prevNotes !== nextNotes ||
        prevStartTime !== nextStartTime ||
        prevEndTime !== nextEndTime;

      if (hasChanged) {
        const updates = {
          notes: nextNotes,
          startTime: nextStartTime,
          endTime: nextEndTime,
        };

        // Update local state
        updateActivityNotes(activity.instanceId, updates);

        // Track as OperationModify for real-time sync
        trackModifyOperation(activity, activeTab, updates).catch((err) => {
          console.error('[AddNotesModal] Failed to save modify operation:', err);
        });
      }
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
            {/* Swipeable Drag Indicator */}
            <GestureDetector gesture={swipeGesture}>
              <View style={styles.dragIndicatorContainer}>
                <View style={styles.dragIndicator} />
              </View>
            </GestureDetector>

            {/* Header */}
            <Pressable style={styles.header} onPress={() => setTimeModalVisible(false)}>
              <Text style={styles.placeName} numberOfLines={1}>
                {activity.name}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.doneButton}>Done</Text>
              </TouchableOpacity>
            </Pressable>

            {/* Notes Input */}
            <Pressable style={styles.notesInputContainer} onPress={() => setTimeModalVisible(false)}>
              <ScrollView
                contentContainerStyle={styles.notesScrollContent}
              >
                <TextInput
                  ref={notesInputRef}
                  style={styles.notesInput}
                  placeholder={isViewer ? `Notes: ${activity.name}` : `Add notes about ${activity.name}...`}
                  placeholderTextColor="#999"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={() => setTimeModalVisible(false)}
                  textAlignVertical="top"
                  editable={!isViewer}
                />
              </ScrollView>
            </Pressable>

            {/* Add Time Button */}
            <View style={styles.timePickerWrapper} pointerEvents="box-none">
              <View style={styles.timeButtonRow}>
                <TouchableOpacity
                  style={styles.addTimeButton}
                  onPress={() => setTimeModalVisible(true)}
                  pointerEvents="auto"
                  disabled={isViewer}
                >
                  <MaterialIcons name="access-time" size={18} color={Colors.PRIMARY} />
                  <Text style={styles.addTimeText}>
                    {startTime && endTime ? `${format12Hour(startTime)} - ${format12Hour(endTime)}` : 'Add Time'}
                  </Text>
                </TouchableOpacity>

                {/* Clear Time Button - Only show if time is set and user is not a viewer */}
                {startTime && endTime && !isViewer && (
                  <TouchableOpacity
                    style={styles.clearTimeButton}
                    onPress={() => {
                      setTimeModalVisible(false); // Close the time modal first
                      setStartTime('');
                      setEndTime('');
                    }}
                    pointerEvents="auto"
                  >
                    <MaterialIcons name="close" size={18} color="#666" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Time Picker Popover - Only show if not a viewer */}
              {!isViewer && (
                <AddTimeModal
                  visible={timeModalVisible}
                  onClose={() => setTimeModalVisible(false)}
                  initialStartTime={startTime}
                  initialEndTime={endTime}
                  onSave={handleTimeUpdate}
                  currentUserRole={currentUserRole}
                />
              )}
            </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    height: '48%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalContentExpanded: {
    height: '75%',
  },
  dragIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  placeName: {
    fontFamily: 'outfit-medium',
    fontSize: 20,
    color: Colors.PRIMARY,
    flex: 1,
    marginRight: 10,
  },
  doneButton: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.PRIMARY,
  },
  notesInputContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },
  notesScrollContent: {
    flexGrow: 1,
  },
  notesInput: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.PRIMARY,
  },
  timePickerWrapper: {
    position: 'relative',
    marginBottom: 30,
  },
  timeButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    gap: 8,
  },
  clearTimeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTimeText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.PRIMARY,
  },
});

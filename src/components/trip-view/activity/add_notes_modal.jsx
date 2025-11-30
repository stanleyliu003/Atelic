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
  Pressable
} from 'react-native';
import { Colors } from '../../../../constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCreateTrip } from '../../../../context/CreateTripContext';
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

export function AddNotesModal({ visible, onClose, activity, activeTab }) {
  const { updateActivityNotes } = useCreateTrip();
  const [notes, setNotes] = useState(activity.notes || '');
  const isWishlist = activeTab === 'wishlist';
  const [startTime, setStartTime] = useState(isWishlist ? '' : (activity.startTime || ''));
  const [endTime, setEndTime] = useState(isWishlist ? '' : (activity.endTime || ''));
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const notesInputRef = useRef(null);

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
    updateActivityNotes(activity.instanceId, {
      notes: notes.trim(),
      startTime: isWishlist ? '' : startTime,
      endTime: isWishlist ? '' : endTime,
    });
    onClose();
  };

  const handleClose = () => {
    // Save changes when closing via backdrop
    updateActivityNotes(activity.instanceId, {
      notes: notes.trim(),
      startTime: isWishlist ? '' : startTime,
      endTime: isWishlist ? '' : endTime,
    });
    onClose();
  };

  const handleTimeUpdate = (start, end) => {
    setStartTime(start);
    setEndTime(end);
  };

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
          <View
            style={styles.modalContent}
            pointerEvents="auto"
          >
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
                  placeholder={`Add notes about ${activity.name}...`}
                  placeholderTextColor="#999"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={() => setTimeModalVisible(false)}
                  textAlignVertical="top"
                />
              </ScrollView>
            </Pressable>

            {/* Add Time Button - Only show if NOT in wishlist */}
            {!isWishlist && (
              <View style={styles.timePickerWrapper} pointerEvents="box-none">
                <TouchableOpacity
                  style={styles.addTimeButton}
                  onPress={() => setTimeModalVisible(true)}
                  pointerEvents="auto"
                >
                  <MaterialIcons name="access-time" size={18} color={Colors.PRIMARY} />
                  <Text style={styles.addTimeText}>
                    {startTime && endTime ? `${format12Hour(startTime)} - ${format12Hour(endTime)}` : 'Add Time'}
                  </Text>
                </TouchableOpacity>

                {/* Time Picker Popover */}
                <AddTimeModal
                  visible={timeModalVisible}
                  onClose={() => setTimeModalVisible(false)}
                  initialStartTime={startTime}
                  initialEndTime={endTime}
                  onSave={handleTimeUpdate}
                />
              </View>
            )}
          </View>
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
    minHeight: 200,
  },
  notesInput: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.PRIMARY,
    minHeight: 200,
  },
  timePickerWrapper: {
    position: 'relative',
    marginBottom: 30,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    gap: 8,
  },
  addTimeText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.PRIMARY,
  },
});

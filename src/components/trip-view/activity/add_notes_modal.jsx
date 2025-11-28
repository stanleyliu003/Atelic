import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Colors } from '../../../../constants/Colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCreateTrip } from '../../../../context/CreateTripContext';
import AddTimeModal from './add_time_modal';

export function AddNotesModal({ visible, onClose, activity }) {
  const { updateActivityNotes } = useCreateTrip();
  const [notes, setNotes] = useState(activity.notes || '');
  const [startTime, setStartTime] = useState(activity.startTime || '');
  const [endTime, setEndTime] = useState(activity.endTime || '');
  const [timeModalVisible, setTimeModalVisible] = useState(false);

  const handleSave = () => {
    updateActivityNotes(activity.instanceId, {
      notes: notes.trim(),
      startTime,
      endTime,
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
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.placeName} numberOfLines={1}>
                {activity.name}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.doneButton}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Notes Input */}
            <ScrollView style={styles.notesInputContainer}>
              <TextInput
                style={styles.notesInput}
                placeholder="Add notes about this place..."
                placeholderTextColor="#999"
                multiline
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />
            </ScrollView>

            {/* Add Time Button */}
            <TouchableOpacity
              style={styles.addTimeButton}
              onPress={() => setTimeModalVisible(true)}
            >
              <MaterialIcons name="access-time" size={18} color={Colors.PRIMARY} />
              <Text style={styles.addTimeText}>
                {startTime && endTime ? `${startTime} - ${endTime}` : 'Add Time'}
              </Text>
            </TouchableOpacity>

            {/* Time Modal */}
            <AddTimeModal
              visible={timeModalVisible}
              onClose={() => setTimeModalVisible(false)}
              initialStartTime={startTime}
              initialEndTime={endTime}
              onSave={handleTimeUpdate}
            />
          </TouchableOpacity>
        </TouchableOpacity>
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
    height: '70%',
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
  notesInput: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.PRIMARY,
    minHeight: 100,
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
  addTimeText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.PRIMARY,
  },
});

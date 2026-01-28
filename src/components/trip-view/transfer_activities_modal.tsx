import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatDayTab } from '../../utils/dateFormatting';

type DayOption = number | 'wishlist';

interface TransferActivitiesModalProps {
  visible: boolean;
  daysArray: DayOption[];
  selectedDay: DayOption;
  onSelectDay: (day: DayOption) => void;
  onConfirm?: () => void; // Made optional since we auto-transfer now
  onClose: () => void;
  startDate?: string | null;
}

export const TransferActivitiesModal: React.FC<TransferActivitiesModalProps> = ({
  visible,
  daysArray,
  selectedDay,
  onSelectDay,
  onConfirm,
  onClose,
  startDate,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* X Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={26.25} color="#222" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
          Where do you want to move these activities?</Text>
          <FlatList
            data={daysArray}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.toString()}
            contentContainerStyle={styles.dayPickerList}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.dayPickerItem,
                  selectedDay === item && styles.dayPickerItemSelected
                ]}
                onPress={() => onSelectDay(item)}
              >
                <Text style={[
                  styles.dayPickerText,
                  selectedDay === item && styles.dayPickerTextSelected
                ]}>
                  {item === 'wishlist'
                    ? 'Saved Places'
                    : startDate
                      ? formatDayTab(startDate, item as number)
                      : `Day ${item}`
                  }
                </Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 15, // 1.5x of 10
    width: 40, // 1.5x of 20
    height: 40, // 1.5x of 20
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'outfit',
    marginBottom: 22,
    textAlign: 'center',
  },
  dayPickerList: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 80,
  },
  dayPickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  dayPickerItemSelected: {
    backgroundColor: Colors.PRIMARY,
  },
  dayPickerText: {
    fontFamily: 'outfit-medium',
    fontSize: 17,
    color: '#888',
  },
  dayPickerTextSelected: {
    color: Colors.WHITE,
  },
}); 
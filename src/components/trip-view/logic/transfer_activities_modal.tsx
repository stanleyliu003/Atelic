import { Colors } from '../../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type DayOption = number | 'wishlist';

interface TransferActivitiesModalProps {
  visible: boolean;
  daysArray: DayOption[];
  selectedDay: DayOption;
  onSelectDay: (day: DayOption) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const TransferActivitiesModal: React.FC<TransferActivitiesModalProps> = ({
  visible,
  daysArray,
  selectedDay,
  onSelectDay,
  onConfirm,
  onClose,
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
            <Ionicons name="close" size={17.5} color="#222" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Where do you want to move these activities?</Text>
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
                  {item === 'wishlist' ? 'Wishlist' : `Day ${item}`}
                </Text>
              </Pressable>
            )}
          />
          <Pressable style={styles.checkmarkButton} onPress={onConfirm}>
            <Ionicons name="checkmark" size={32} color={Colors.WHITE} />
          </Pressable>
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
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'outfit',
    marginBottom: 22,
    textAlign: 'center',
  },
  dayPickerList: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  dayPickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  dayPickerItemSelected: {
    backgroundColor: Colors.PRIMARY,
  },
  dayPickerText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#888',
  },
  dayPickerTextSelected: {
    color: Colors.WHITE,
  },
  checkmarkButton: {
    marginTop: 12,
    backgroundColor: '#222',
    borderRadius: 32,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 
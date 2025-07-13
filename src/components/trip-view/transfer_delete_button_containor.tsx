import { Colors } from '../../../constants/Colors';
import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TabType = 'wishlist' | `day${number}`;

interface TransferButtonContainerProps {
  activeTab: TabType;
  isSelectionMode: boolean;
  selectedActivities: string[];
  onTransferPress: () => void;
  onDeletePress: () => void; // New prop for delete functionality
}

export const TransferButtonContainer: React.FC<TransferButtonContainerProps> = ({
  activeTab,
  isSelectionMode,
  selectedActivities,
  onTransferPress,
  onDeletePress,
}) => {
  if (!isSelectionMode || selectedActivities.length === 0) return null;

  let buttonText = '';
  if (activeTab === 'wishlist') {
    buttonText = `Move ${selectedActivities.length} Activities`;
  } else if (activeTab.startsWith('day')) {
    buttonText = `Move ${selectedActivities.length} Activities`;
  }

  return (
    <View style={styles.buttonContainer}>
      {/* Trash Button */}
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={onDeletePress}
      >
        <Feather name="trash" size={21} color="red" />
      </TouchableOpacity>

      {/* Transfer Button */}
      <TouchableOpacity 
        style={styles.transferButton}
        onPress={onTransferPress}
      >
        <Text style={styles.transferButtonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    zIndex: 2,
  },
  deleteButton: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  transferButton: {
    backgroundColor: Colors.PRIMARY,
    padding: 14, // Match the trash button padding
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center', // Center the text vertically
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  transferButtonText: {
    color: Colors.WHITE,
    fontFamily: 'outfit-bold',
    fontSize: 13,
  },
}); 
import { Colors } from '../../../constants/Colors';
import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TabType = 'overview' | 'wishlist' | `day${number}`;

interface TransferButtonContainerProps {
  activeTab: TabType;
  isSelectionMode: boolean;
  selectedActivities: string[];
  onTransferPress: () => void;
  onDeletePress: () => void; // New prop for delete functionality
  currentUserRole?: 'owner' | 'editor' | 'viewer';
}

export const TransferButtonContainer: React.FC<TransferButtonContainerProps> = ({
  activeTab,
  isSelectionMode,
  selectedActivities,
  onTransferPress,
  onDeletePress,
  currentUserRole,
}) => {
  if (!isSelectionMode || selectedActivities.length === 0 || currentUserRole === 'viewer') return null;

  let buttonText = '';
  if (activeTab === 'wishlist') {
    buttonText = `Move ${selectedActivities.length} Activities`;
  } else if (activeTab.startsWith('day')) {
    buttonText = `Move ${selectedActivities.length} Activities`;
  }

  return (
    <View style={styles.buttonContainer}>
      {/* Trash Button - now visible on all tabs including wishlist/saved places */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={onDeletePress}
      >
        <Feather name="trash" size={24} color="red" />
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
    padding: 14,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  transferButton: {
    backgroundColor: Colors.PRIMARY,
    padding: 14,
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
    fontFamily: 'outfit-medium',
    fontSize: 17,
  },
}); 
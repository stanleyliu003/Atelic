import { Colors } from '../../../../constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

type TabType = 'wishlist' | `day${number}`;

interface TransferButtonContainerProps {
  activeTab: TabType;
  isSelectionMode: boolean;
  selectedActivities: string[];
  onTransferPress: () => void;
}

export const TransferButtonContainer: React.FC<TransferButtonContainerProps> = ({
  activeTab,
  isSelectionMode,
  selectedActivities,
  onTransferPress,
}) => {
  if (!isSelectionMode || selectedActivities.length === 0) return null;

  let buttonText = '';
  if (activeTab === 'wishlist') {
    buttonText = `Transfer ${selectedActivities.length} Activities`;
  } else if (activeTab.startsWith('day')) {
    buttonText = `Transfer ${selectedActivities.length} Activities`;
  }

  return (
    <TouchableOpacity 
      style={styles.transferButton}
      onPress={onTransferPress}
    >
      <Text style={styles.transferButtonText}>{buttonText}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  transferButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    left: 'auto',
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  transferButtonText: {
    color: Colors.WHITE,
    fontFamily: 'outfit',
    fontSize: 10,
  },
}); 
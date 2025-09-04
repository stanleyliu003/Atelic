import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AddPlacesButtonProps {
  onPress: () => void;
  isAddingPlace?: boolean;
  disabled?: boolean;
  style?: any; // Allow custom styles to be passed
  containerStyle?: any; // Allow custom container styles
  showLoadingIndicator?: boolean; // Control whether to show loading indicator
}

export function AddPlacesButton({
  onPress,
  isAddingPlace = false,
  disabled = false,
  style,
  containerStyle,
  showLoadingIndicator = true
}: AddPlacesButtonProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {/* Loading indicator for adding place */}
      {showLoadingIndicator && isAddingPlace && (
        <View style={styles.addingPlaceContainer}>
          <ActivityIndicator size="large" color={Colors.PRIMARY} />
          <Text style={styles.addingPlaceText}>Adding place...</Text>
        </View>
      )}

      {/* Add additional places button */}
      <TouchableOpacity 
        style={[
          styles.addPlacesButton, 
          isAddingPlace && styles.addPlacesButtonDisabled,
          style
        ]}
        onPress={onPress}
        disabled={disabled || isAddingPlace}
      >
        <Ionicons 
          name="add-circle-outline" 
          size={24} 
          color={isAddingPlace ? Colors.GRAY : Colors.PRIMARY} 
        />
        <Text style={[
          styles.addPlacesButtonText, 
          isAddingPlace && styles.addPlacesButtonTextDisabled
        ]}>
          Add additional places
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Default container style - can be overridden
  },
  addingPlaceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginVertical: 10,
  },
  addingPlaceText: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: Colors.GRAY,
    marginTop: 10,
  },
  addPlacesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.GRAY,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginVertical: -12,
    marginHorizontal: 5,
  },
  addPlacesButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 16,
    color: Colors.PRIMARY,
    marginLeft: 8,
  },
  addPlacesButtonDisabled: {
    borderColor: Colors.GRAY,
    opacity: 0.6,
  },
  addPlacesButtonTextDisabled: {
    color: Colors.GRAY,
  },
});

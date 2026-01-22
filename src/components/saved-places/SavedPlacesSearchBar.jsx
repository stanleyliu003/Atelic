import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * SavedPlacesSearchBar Component
 * A search bar for filtering saved places by city/region name
 *
 * @param {string} value - Current search query value
 * @param {function} onChangeText - Callback when text changes
 * @param {string} placeholder - Optional placeholder text
 */
export const SavedPlacesSearchBar = ({
  value,
  onChangeText,
  placeholder = 'Ex: Rome, Italy',
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.searchIconContainer}>
        <Feather name="search" size={24} color="black" />
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={20} color="#999" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    height: 55,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingLeft: 50,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIconContainer: {
    position: 'absolute',
    left: 15,
    justifyContent: 'center',
    alignItems: 'center',
    height: 24,
    width: 24,
  },
  input: {
    flex: 1,
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#1a1a1a',
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
  },
});

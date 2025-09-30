import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../../constants/Colors';

/**
 * SearchBar Component
 * A touchable search bar that opens autocomplete modal when pressed
 * Displays current search query but is not directly editable
 *
 * @param {string} value - Current search query value to display
 * @param {function} onChangeText - Callback when text changes (for clear button)
 * @param {function} onPress - Callback when search bar is pressed (opens modal)
 * @param {string} placeholder - Optional placeholder text
 */
export const SearchBar = ({
  value,
  onChangeText,
  onPress,
  placeholder = 'Search activities...',
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.searchBar} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name="search" size={20} color="#666" style={styles.icon} />
        <TextInput
          style={styles.input}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#999"
          editable={false}
          pointerEvents="none"
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
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 20,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
  },
});
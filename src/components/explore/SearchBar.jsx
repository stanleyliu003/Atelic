import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

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
  placeholder = 'Add places',
}) => {
  return (
    <TouchableOpacity style={styles.searchBar} onPress={onPress} activeOpacity={0.5}>
      <Ionicons name="search" size={16} color="#8E8E93" />
      <Text style={value ? styles.valueText : styles.placeholderText} numberOfLines={1}>
        {value || placeholder}
      </Text>
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle-outline" size={16} color="#C7C7CC" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  placeholderText: {
    flex: 1,
    fontFamily: 'outfit',
    fontSize: 15,
    color: '#8E8E93',
  },
  valueText: {
    flex: 1,
    fontFamily: 'outfit',
    fontSize: 15,
    color: '#1C1C1E',
  },
});

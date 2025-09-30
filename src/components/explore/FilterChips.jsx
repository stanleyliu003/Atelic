import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../../constants/Colors';
import { EXPLORE_FILTERS } from '../../../constants/Filters';

/**
 * FilterChips Component
 * Displays a horizontal scrollable row of filter chips
 * Each chip can be toggled on/off to filter search results
 *
 * @param {string[]} selectedFilters - Array of selected filter IDs
 * @param {function} onFilterToggle - Callback when a filter is toggled (receives filterId)
 */
export const FilterChips = ({ selectedFilters = [], onFilterToggle }) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {EXPLORE_FILTERS.map((filter) => {
          const isSelected = selectedFilters.includes(filter.id);

          return (
            <TouchableOpacity
              key={filter.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onFilterToggle(filter.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>{filter.emoji}</Text>
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    gap: 6,
  },
  chipSelected: {
    backgroundColor: '#e8f4fd',
    borderColor: Colors.PRIMARY,
  },
  emoji: {
    fontSize: 16,
  },
  label: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#333',
  },
  labelSelected: {
    fontFamily: 'outfit-medium',
    color: Colors.PRIMARY,
  },
});
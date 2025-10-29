import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Colors } from '../../../constants/Colors';
import { FILTERS_UNDER_18, FILTERS_OVER_18 } from '../../../constants/Filters';
import { Auth } from 'aws-amplify';

/**
 * FilterChips Component
 * Displays a horizontal scrollable row of filter chips
 * Each chip can be toggled on/off to filter search results
 * Filters are age-appropriate based on user's Cognito birthdate
 *
 * @param {string[]} selectedFilters - Array of selected filter IDs
 * @param {function} onFilterToggle - Callback when a filter is toggled (receives filterId)
 */
export const FilterChips = ({ selectedFilters = [], onFilterToggle }) => {
  const [filters, setFilters] = useState(FILTERS_OVER_18); // Default to over 18
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserAge = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        const attributes = await Auth.userAttributes(user);

        // Find the birthdate attribute
        const birthdateAttr = attributes.find(attr => attr.Name === 'birthdate');

        if (birthdateAttr && birthdateAttr.Value) {
          // Calculate age from birthdate (format: YYYY-MM-DD)
          const birthDate = new Date(birthdateAttr.Value);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();

          // Adjust age if birthday hasn't occurred this year yet
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }

          // Set filters based on age
          if (age < 18) {
            setFilters(FILTERS_UNDER_18);
          } else {
            setFilters(FILTERS_OVER_18);
          }
        } else {
          // Default to over 18 filters if birthdate not found
          setFilters(FILTERS_OVER_18);
        }
      } catch (error) {
        console.error('Error fetching user age:', error);
        // Default to over 18 filters on error
        setFilters(FILTERS_OVER_18);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAge();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.PRIMARY} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filters.map((filter) => {
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
  loadingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
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
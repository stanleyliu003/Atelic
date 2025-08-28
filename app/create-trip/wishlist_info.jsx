import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { WishlistActivities } from '../../src/components/trip-view';
import { Colors } from './../../constants/Colors';

export default function WishlistInfo() {
    const router = useRouter();
    const { activities, updateActivities } = useCreateTrip();
    
    // State for selected activities - initialize with all activities selected
    const [selectedActivities, setSelectedActivities] = useState([]);
    // Loading state for create trip
    const [loading, setLoading] = useState(false);

    // Initialize only user-selected activities (not recommendations) as selected when component mounts or activities change
    useEffect(() => {
        if (activities && activities.length > 0) {
            const userActivityIds = activities
                .filter(activity => activity.place_id && !activity.is_recommended)
                .map(activity => activity.place_id);
            setSelectedActivities(userActivityIds);
        }
    }, [activities]);

    // Handle activity selection
    const handleActivitySelect = (activityId) => {
        setSelectedActivities(prev => [...prev, activityId]);
    };

    // Handle activity deselection
    const handleActivityDeselect = (activityId) => {
        setSelectedActivities(prev => prev.filter(id => id !== activityId));
    };

    // Handle create trip button press
    const handleCreateTrip = () => {
        setLoading(true);
        // Filter activities to only include selected ones
        const selectedActivitiesList = activities.filter(activity => 
            activity.place_id && selectedActivities.includes(activity.place_id)
        );
        
        // Update the context with only selected activities
        updateActivities(selectedActivitiesList);
        
        // Simulate async navigation for better UX (remove if not needed)
        setTimeout(() => {
        router.push('/trip-view/trip-view_main');
            setLoading(false);
        }, 500);
    };

    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={()=>router.replace('/create-trip/create_trip_3_categories')}>
          <Ionicons name="arrow-back" size={32} color="black" />
        </TouchableOpacity>

        <View style={styles.header}>
            <Text style={styles.title}>Trip Wishlist</Text>
        </View>

        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* User-selected activities (not grouped by city) */}
          <WishlistActivities 
              activities={(activities || []).filter(a => !a.is_recommended)} 
              selectedActivities={selectedActivities}
              onActivitySelect={handleActivitySelect}
              onActivityDeselect={handleActivityDeselect}
              showSelectionIndicator={true}
              scrollable={false}
          />

          {/* Recommended activities grouped by city */}
          {activities && activities.some(a => a.is_recommended) && (
            <>
              <Text style={styles.recommendedTitle}>Recommendations</Text>
              {(() => {
                const recommendedActivities = activities.filter(a => a.is_recommended);
                const recommendedByCity = recommendedActivities.reduce((acc, activity) => {
                  const city = activity.city || 'Unknown City';
                  if (!acc[city]) acc[city] = [];
                  acc[city].push(activity);
                  return acc;
                }, {});

                return Object.entries(recommendedByCity).map(([city, cityActivities]) => (
                  <View key={`recommended-${city}`} style={styles.citySection}>
                    <Text style={styles.cityTitle}>{city}</Text>
                    <WishlistActivities 
                        activities={cityActivities} 
                        selectedActivities={selectedActivities}
                        onActivitySelect={handleActivitySelect}
                        onActivityDeselect={handleActivityDeselect}
                        showSelectionIndicator={true}
                        scrollable={false}
                    />
                  </View>
                ));
              })()}
            </>
          )}
        </ScrollView>

        {/* Create Trip Button */}
        <TouchableOpacity
          onPress={handleCreateTrip}
          style={[
            styles.createTripButton,
            (selectedActivities.length === 0 || loading) && styles.disabledButton
          ]}
          disabled={selectedActivities.length === 0 || loading}
        >
          <Text style={styles.createTripButtonText}>
            {loading ? 'Creating Trip...' : 'Create Trip'}
          </Text>
        </TouchableOpacity>
      </View>
    )
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 25,
      paddingTop: 55,
      backgroundColor: Colors.WHITE,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 15,
      marginBottom: 10,
    },
    title: {
      fontFamily: 'outfit-bold',
      fontSize: 35,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    recommendedTitle: {
      fontFamily: 'outfit-bold',
      fontSize: 24,
      marginTop: 25,
      marginBottom: 10,
      textAlign: 'center',
    },
    citySection: {
      marginBottom: 10,
    },
    cityTitle: {
      fontFamily: 'outfit-bold',
      fontSize: 24,
      marginTop: -5,
      textAlign: 'center',
      marginBottom: 15,
      color: '#1a1a1a',
    },
    createTripButton: {
      padding: 20,
      backgroundColor: Colors.PRIMARY,
      borderRadius: 15,
      marginTop: 30,
      marginBottom: 20,
    },
    disabledButton: {
      backgroundColor: Colors.GRAY,
      opacity: 0.6,
    },
    createTripButtonText: {
      color: Colors.WHITE,
      textAlign: 'center',
      fontFamily: 'outfit-bold',
    }
});
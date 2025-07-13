import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { WishlistActivities } from '../../src/components/trip-view';
import { Colors } from './../../constants/Colors';

export default function WishlistInfo() {
    const router = useRouter();
    const { activities, updateActivities } = useCreateTrip();
    
    // State for selected activities - initialize with all activities selected
    const [selectedActivities, setSelectedActivities] = useState([]);

    // Initialize all activities as selected when component mounts or activities change
    useEffect(() => {
        if (activities && activities.length > 0) {
            const allActivityIds = activities
                .filter(activity => activity.place_id)
                .map(activity => activity.place_id);
            setSelectedActivities(allActivityIds);
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
        // Filter activities to only include selected ones
        const selectedActivitiesList = activities.filter(activity => 
            activity.place_id && selectedActivities.includes(activity.place_id)
        );
        
        // Update the context with only selected activities
        updateActivities(selectedActivitiesList);
        
        // Navigate to trip view
        router.push('/trip-view/trip-view_main');
    };

    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={()=>router.replace('/create-trip/text_recognition')}>
          <Ionicons name="arrow-back" size={32} color="black" />
        </TouchableOpacity>

        <View style={styles.header}>
            <Text style={styles.title}>Wishlist Activities</Text>
        </View>

        {/* Use the shared WishlistActivities component with selection functionality */}
        <WishlistActivities 
            activities={activities || []} 
            selectedActivities={selectedActivities}
            onActivitySelect={handleActivitySelect}
            onActivityDeselect={handleActivityDeselect}
            showSelectionIndicator={true}
        />
        
        {/* Create Trip Button */}
        <TouchableOpacity
          onPress={handleCreateTrip}
          style={[
            styles.createTripButton,
            selectedActivities.length === 0 && styles.disabledButton
          ]}
          disabled={selectedActivities.length === 0}
        >
          <Text style={styles.createTripButtonText}>
            Create Trip
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
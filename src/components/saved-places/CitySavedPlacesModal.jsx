import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityCard } from '../trip-view/activity/activity_card';
import { ActivityDetailView } from '../trip-view/description_card';

export function CitySavedPlacesModal({ visible, onClose, cityName, places }) {
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [descriptionCardVisible, setDescriptionCardVisible] = useState(false);

  const handleActivityPress = (activity) => {
    setSelectedActivity(activity);
    setDescriptionCardVisible(true);
  };

  const handleDescriptionCardClose = () => {
    setDescriptionCardVisible(false);
    setSelectedActivity(null);
  };

  const renderActivityItem = ({ item }) => {
    console.log('[CitySavedPlacesModal] Rendering item:', {
      savedPlaceId: item.savedPlaceId,
      city: item.city,
      hasActivity: !!item.activity,
      activityName: item.activity?.name
    });
    
    // Extract the activity data from the saved place
    const activity = item.activity; // The DynamoDB field is 'activity', not 'activityData'
    
    // Skip rendering if activity data is missing
    if (!activity) {
      console.warn('[CitySavedPlacesModal] Skipping item with missing activity');
      return null;
    }
    
    return (
      <ActivityCard
        activity={activity}
        onDescriptionCardPress={() => handleActivityPress(activity)}
        hideNotesButton={true}
        hideRouteInfo={true}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="arrow-back" size={28} color={Colors.PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{cityName}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Activity List */}
        {places && places.length > 0 ? (
          <FlatList
            data={places}
            renderItem={renderActivityItem}
            keyExtractor={(item, index) => item.savedPlaceId || `saved-place-${index}`}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={Colors.GRAY} />
            <Text style={styles.emptyText}>No saved places in {cityName}</Text>
          </View>
        )}

        {/* Description Card Modal */}
        {selectedActivity && descriptionCardVisible && (
          <ActivityDetailView
            activity={selectedActivity}
            onClose={handleDescriptionCardClose}
            variant="wishlist"
            showDragIndicator={false}
            currentUserRole="owner"
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.WHITE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 22,
    color: Colors.PRIMARY,
  },
  placeholder: {
    width: 44, // Same width as close button to center title
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: 'outfit',
    fontSize: 18,
    color: Colors.GRAY,
    marginTop: 16,
    textAlign: 'center',
  },
});

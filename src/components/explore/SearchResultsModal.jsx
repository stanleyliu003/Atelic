import { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Colors } from '../../../constants/Colors';
import { WishlistActivities } from '../trip-view/wishlist_activities';

/**
 * SearchResultsModal Component
 * Shows search results with selectable activity cards
 * User can select multiple activities and save them to wishlist
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {string} query - Search query that was used
 * @param {Activity[]} activities - Array of activity objects to display
 * @param {function} onSave - Callback when "Save to Wishlist" is clicked (receives array of selected activities)
 * @param {function} onClose - Callback to close modal
 */
export const SearchResultsModal = ({ visible, query, activities, onSave, onClose }) => {
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);

  // Toggle activity selection
  const handleActivityToggle = (activityId) => {
    setSelectedActivityIds((prev) => {
      if (prev.includes(activityId)) {
        return prev.filter((id) => id !== activityId);
      } else {
        return [...prev, activityId];
      }
    });
  };

  // Handle save button press
  const handleSave = () => {
    const selectedActivities = activities.filter((activity) =>
      selectedActivityIds.includes(activity.place_id)
    );
    onSave(selectedActivities);
    // Reset selection
    setSelectedActivityIds([]);
  };

  // Handle modal close
  const handleClose = () => {
    setSelectedActivityIds([]);
    onClose();
  };

  // Swipe down gesture to close
  const swipeGesture = Gesture.Pan()
    .onEnd((event) => {
      // If swiped down more than 100px with sufficient velocity, close the modal
      if (event.translationY > 100 && event.velocityY > 0) {
        runOnJS(handleClose)();
      }
    });

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <GestureHandlerRootView style={styles.modalContainer}>
          {/* Swipeable Drag Indicator */}
          <GestureDetector gesture={swipeGesture}>
            <View style={styles.dragIndicatorContainer}>
              <View style={styles.dragIndicator} />
            </View>
          </GestureDetector>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Results for "{query}"</Text>
              <Text style={styles.headerSubtitle}>
                {activities.length} {activities.length === 1 ? 'place' : 'places'} found
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Activities List */}
          <ScrollView
            style={styles.activitiesContainer}
            contentContainerStyle={styles.activitiesContent}
            showsVerticalScrollIndicator={false}
          >
            {activities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
              </View>
            ) : (
              <WishlistActivities
                activities={activities}
                selectedActivities={selectedActivityIds}
                onActivitySelect={handleActivityToggle}
                onActivityDeselect={handleActivityToggle}
                showSelectionIndicator={true}
              />
            )}
          </ScrollView>

          {/* Save Button - Only show when activities are selected */}
          {selectedActivityIds.length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.WHITE} />
                <Text style={styles.saveButtonText}>
                  Save {selectedActivityIds.length}{' '}
                  {selectedActivityIds.length === 1 ? 'place' : 'places'} to Wishlist
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </GestureHandlerRootView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.WHITE,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: '85%',
  },
  dragIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingTop: 30,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 20,
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#666',
  },
  activitiesContainer: {
    flex: 1,
  },
  activitiesContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: '#999',
    marginTop: 15,
  },
  emptySubtext: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#ccc',
    marginTop: 5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: Colors.WHITE,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.PRIMARY,
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: Colors.WHITE,
  },
});
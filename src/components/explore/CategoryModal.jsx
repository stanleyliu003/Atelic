import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Colors } from '../../../constants/Colors';
import { WishlistActivities } from '../trip-view/wishlist_activities';
import { ActivityDetailView } from '../trip-view/description_card';

/**
 * CategoryModal Component
 * Shows activities for a specific category with selectable activity cards
 * User can select multiple activities and save them to wishlist
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {string} category - Category name that was selected
 * @param {Activity[]} activities - Array of activity objects to display
 * @param {boolean} loading - Whether activities are being loaded
 * @param {boolean} loadingMore - Whether more activities are being generated (for button loading state)
 * @param {function} onSave - Callback when "Save to Wishlist" is clicked (receives array of selected activities)
 * @param {function} onClose - Callback to close modal
 * @param {function} onGenerateMore - Callback when "Generate More" button is clicked
 * @param {Activity[]} wishlistActivities - Activities already in the wishlist for "On list" tag
 */
export const CategoryModal = ({ visible, category, activities, loading = false, loadingMore = false, onSave, onClose, onGenerateMore, wishlistActivities = [] }) => {
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);

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

  // Handle generating more activities for a category (copied from create_trip_interactive.jsx)
  const handleGenerateMoreActivities = async (categoryName) => {
    try {
      await onGenerateMore(categoryName);
    } catch (error) {
      // Check if this is a limit reached error
      if (error.message && error.message.includes('Activity generation limit reached')) {
        Alert.alert(
          'Activity Limit Reached',
          `Generation limit reached for ${categoryName} category.`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        // Show generic error for other types of errors
        Alert.alert(
          'Error',
          `Failed to generate more activities for ${categoryName}. Please try again.`,
          [{ text: 'OK', style: 'default' }]
        );
      }
    }
  };

  // Handle activity card press to show details
  const handleActivityPress = (activity) => {
    setSelectedActivity(activity);
  };

  // Handle closing activity detail view
  const handleActivityDetailClose = () => {
    setSelectedActivity(null);
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
              <Text style={styles.headerTitle}>{category}</Text>
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
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.PRIMARY} />
                <Text style={styles.loadingText}>Loading activities...</Text>
              </View>
            ) : activities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
              </View>
            ) : (
              <>
                <WishlistActivities
                  activities={activities}
                  selectedActivities={selectedActivityIds}
                  onActivitySelect={handleActivityToggle}
                  onActivityDeselect={handleActivityToggle}
                  onDescriptionCardPress={handleActivityPress}
                  showSelectionIndicator={true}
                  wishlistActivities={wishlistActivities}
                />
                
                {/* Generate More Category Activities Button - Show at bottom of activities list */}
                {onGenerateMore && (
                  <View style={styles.generateMoreContainer}>
                    <TouchableOpacity
                      style={[styles.generateMoreButton, loadingMore && styles.generateMoreButtonDisabled]}
                      onPress={() => !loadingMore && handleGenerateMoreActivities(category)}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <ActivityIndicator size="small" color="#666" />
                      ) : (
                        <Feather name="plus-circle" size={24} color="black" />
                      )}
                      <Text style={[styles.generateMoreButtonText, loadingMore && styles.generateMoreButtonTextDisabled]}>
                        {loadingMore ? 'Loading...' : `More ${category.toLowerCase()}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Save Button - Only show when activities are selected */}
          {selectedActivityIds.length > 0 && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.saveButtonText}>
                  Save to Wishlist {"("}{selectedActivityIds.length}{''}{")"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </GestureHandlerRootView>
      </View>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <Modal visible={true} animationType="slide" transparent={true}>
          <View style={styles.detailModalOverlay}>
            <View style={styles.detailModalContainer}>
              <ActivityDetailView
                activity={selectedActivity}
                onClose={handleActivityDetailClose}
                variant="wishlist"
              />
            </View>
          </View>
        </Modal>
      )}
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
    fontSize: 24,
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontFamily: 'outfit',
    fontSize: 16,
    color: '#666',
  },
  activitiesContainer: {
    flex: 1,
  },
  activitiesContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#666',
    marginTop: 10,
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
    padding: 15,
    backgroundColor: '#F36406',
    borderRadius: 15,
  },
  saveButtonText: {
    color: Colors.WHITE,
    textAlign: 'center',
    fontFamily: 'outfit-bold',
    fontSize: 16,
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContainer: {
    backgroundColor: Colors.WHITE,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: '85%',
    paddingTop: 20,
  },
  generateMoreContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  generateMoreButton: {
    marginTop: -20,
    marginBottom: 70,
    backgroundColor: 'white',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: -20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  generateMoreButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 18,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  generateMoreButtonDisabled: {
    opacity: 0.6,
  },
  generateMoreButtonTextDisabled: {
    color: '#666',
  },
});
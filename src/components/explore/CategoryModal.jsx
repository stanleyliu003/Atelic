import { useState, useEffect } from 'react';
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
import { duplicateActivity } from '../../utils/activityInstanceId';

/**
 * CategoryModal Component
 * Shows activities for a specific category with selectable activity cards
 * User can select multiple activities and save them to wishlist
 *
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether modal is visible
 * @param {string} props.category - Category name that was selected
 * @param {Activity[]} props.activities - Array of activity objects to display
 * @param {boolean} [props.loading] - Whether activities are being loaded
 * @param {boolean} [props.loadingMore] - Whether more activities are being generated (for button loading state)
 * @param {function} props.onSave - Callback when "Save to Wishlist" is clicked (receives array of selected activities)
 * @param {function} props.onClose - Callback to close modal
 * @param {function} [props.onGenerateMore] - Callback when "Generate More" button is clicked
 * @param {Activity[]} [props.wishlistActivities] - Activities already in the wishlist for "On list" tag
 * @param {Activity[]} [props.dayActivities] - Activities already in day tabs (can't be deselected)
 */
export const CategoryModal = ({ visible, category, activities, loading = false, loadingMore = false, onSave, onClose, onGenerateMore, wishlistActivities = [], dayActivities = [] }) => {
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // Track which activities from category results are already in wishlist
  const [wishlistActivityIdsInResults, setWishlistActivityIdsInResults] = useState([]);

  // Track which activities are in day tabs (cannot be deselected)
  const [dayActivityIdsInResults, setDayActivityIdsInResults] = useState([]);

  // Create fresh instances of activities to allow duplicates
  // This regenerates instanceIds for activities that already exist in wishlist/days
  const [displayActivities, setDisplayActivities] = useState([]);


  // Reset state when category changes (user switched to different category)
  useEffect(() => {
    setSelectedActivityIds([]);
    setWishlistActivityIdsInResults([]);
    setDayActivityIdsInResults([]);
  }, [category]);

  // Regenerate instanceIds for all activities to allow duplicates
  // This ensures activities can be added to wishlist even if they're already in day tabs
  useEffect(() => {
    if (activities.length > 0) {
      const freshActivities = activities.map(activity => duplicateActivity(activity));
      setDisplayActivities(freshActivities);
    } else {
      setDisplayActivities([]);
    }
  }, [activities]);

  // Auto-select activities that are in wishlist or day tabs when activities change
  useEffect(() => {
    if (displayActivities.length > 0) {
      // Track display activities in wishlist (match by place_id, store NEW instanceId from displayActivities)
      const wishlistPlaceIds = wishlistActivities.map(a => a.place_id).filter(Boolean);
      const activitiesInWishlist = displayActivities
        .filter(activity => activity.place_id && wishlistPlaceIds.includes(activity.place_id))
        .map(activity => activity.instanceId);

      // Track display activities in day tabs (match by place_id, store NEW instanceId from displayActivities)
      const dayPlaceIds = dayActivities.map(a => a.place_id).filter(Boolean);
      const activitiesInDays = displayActivities
        .filter(activity => activity.place_id && dayPlaceIds.includes(activity.place_id))
        .map(activity => activity.instanceId);

      setWishlistActivityIdsInResults(activitiesInWishlist);
      setDayActivityIdsInResults(activitiesInDays);

      // Only auto-select wishlist activities (not day activities)
      // Day activities should appear unselected since they're no longer in the wishlist
      // Don't include prev state - start fresh based on current wishlist
      const autoSelectedIds = [...new Set([...activitiesInWishlist])];
      setSelectedActivityIds(autoSelectedIds);
    } else {
      // Reset when activities are cleared
      setWishlistActivityIdsInResults([]);
      setDayActivityIdsInResults([]);
      setSelectedActivityIds([]);
    }
  }, [displayActivities, wishlistActivities, dayActivities]);

  // Toggle activity selection
  // We always allow toggling; handleSave is responsible for making sure
  // we don't actually remove wishlist items that are in day tabs.
  const handleActivityToggle = (activityId) => {
    setSelectedActivityIds((prev) => {
      const isCurrentlySelected = prev.includes(activityId);
      if (isCurrentlySelected) {
        return prev.filter((id) => id !== activityId);
      }
      return [...prev, activityId];
    });
  };

  // Handle save button press
  const handleSave = () => {
    // Get newly selected activities (not in wishlist) - use NEW instanceIds from displayActivities
    // Attach the category name to each activity for icon mapping
    const newlySelectedActivities = displayActivities
      .filter((activity) =>
        activity.instanceId &&
        selectedActivityIds.includes(activity.instanceId) &&
        !wishlistActivityIdsInResults.includes(activity.instanceId)
      )
      .map((activity) => ({
        ...activity,
        category: category, // Attach category name to activity
      }));

    // Map deselected display activities back to the REAL wishlist instanceIds.
    // Important: wishlistActivities passed from TripViewMain already EXCLUDES any
    // activities that are in day tabs, so it's always safe to remove them here.
    //
    // 1) Find display instanceIds that represent wishlist items and are now deselected
    const deselectedDisplayIds = wishlistActivityIdsInResults.filter(
      (activityId) => !selectedActivityIds.includes(activityId)
    );

    // 2) Build lookup: display instanceId -> place_id
    const displayIdToPlaceId = new Map(
      displayActivities
        .filter(a => a.instanceId && a.place_id)
        .map(a => [a.instanceId, a.place_id])
    );

    // 3) For each deselected display card, collect the underlying wishlist instanceIds
    //    (by place_id) to actually remove from context.
    const deselectedWishlistInstanceIdsSet = new Set();

    deselectedDisplayIds.forEach(displayId => {
      const placeId = displayIdToPlaceId.get(displayId);
      if (!placeId) return;

      (wishlistActivities || [])
        .filter(a => a.place_id === placeId && a.instanceId)
        .forEach(a => {
          deselectedWishlistInstanceIdsSet.add(a.instanceId);
        });
    });

    const deselectedWishlistActivityIds = Array.from(deselectedWishlistInstanceIdsSet);

    // Call onSave with both additions and removals
    onSave(newlySelectedActivities, deselectedWishlistActivityIds);

    // Reset selection
    setSelectedActivityIds([]);
    setWishlistActivityIdsInResults([]);
    setDayActivityIdsInResults([]);
  };

  // Handle modal close
  const handleClose = () => {
    setSelectedActivityIds([]);
    setWishlistActivityIdsInResults([]);
    setDayActivityIdsInResults([]);
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
                {displayActivities.length} {displayActivities.length === 1 ? 'place' : 'places'} found
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
            ) : displayActivities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
              </View>
            ) : (
              <>
                <WishlistActivities
                  activities={displayActivities}
                  selectedActivities={selectedActivityIds}
                  onActivitySelect={handleActivityToggle}
                  onActivityDeselect={handleActivityToggle}
                  onDescriptionCardPress={handleActivityPress}
                  showSelectionIndicator={true}
                  wishlistActivities={[]}
                  hideNotesButton={true}
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

          {/* Save Button - Show when there are any changes (additions or removals) */}
          {(() => {
            const hasNewSelections = selectedActivityIds.some(id => !wishlistActivityIdsInResults.includes(id));
            const hasDeselections = wishlistActivityIdsInResults.some(id => !selectedActivityIds.includes(id));
            const hasChanges = hasNewSelections || hasDeselections;
            
            return hasChanges && (
              <View style={styles.footer}>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
                  <Text style={styles.saveButtonText}>
                    Save to Wishlist
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}
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
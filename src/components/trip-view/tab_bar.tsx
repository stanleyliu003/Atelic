import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Animated, PanResponder } from 'react-native';
import { formatDayTab } from '../../utils/dateFormatting';

type TabType = 'overview' | 'wishlist' | `day${number}`;

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  dayCount: number;
  onAddDay: () => void;
  onDeleteDay: (dayNumber?: number) => void;
  onReorderDays?: (fromDay: number, toDay: number) => void;
  shouldScrollToActive?: boolean;
  tabLabels?: TabType[];
  currentUserRole?: 'owner' | 'editor' | 'viewer';
  startDate?: string | null;
  showOverviewTab?: boolean;
  showDayButtons?: boolean;
  usePrimaryStyle?: boolean; // Use primary toggle styling
  isDeleteMode?: boolean; // Controlled delete mode state
  onDeleteModeChange?: (isDeleteMode: boolean) => void; // Callback when delete mode changes
}

export function TabBar({
  activeTab,
  onTabChange,
  dayCount,
  onAddDay,
  onDeleteDay,
  onReorderDays,
  shouldScrollToActive = false,
  tabLabels,
  currentUserRole,
  startDate,
  showOverviewTab = false,
  showDayButtons = true,
  usePrimaryStyle = false,
  isDeleteMode: controlledDeleteMode,
  onDeleteModeChange
}: TabBarProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [internalDeleteMode, setInternalDeleteMode] = React.useState(false);

  // Use controlled mode if props are provided, otherwise use internal state
  const isDeleteMode = controlledDeleteMode !== undefined ? controlledDeleteMode : internalDeleteMode;
  const setIsDeleteMode = (value: boolean) => {
    if (onDeleteModeChange) {
      onDeleteModeChange(value);
    } else {
      setInternalDeleteMode(value);
    }
  };
  // Reorder mode disabled
  const reorderMode = false;
  const selectedDayForReorder = null;

  // Generate tab order: use tabLabels if provided, otherwise default
  let tabs: TabType[] = tabLabels ?? ([
    'wishlist',
    ...Array.from({ length: dayCount }, (_, i) => `day${i + 1}` as TabType)
  ]);

  // Prepend overview tab if requested
  if (showOverviewTab && !tabs.includes('overview')) {
    tabs = ['overview' as TabType, ...tabs];
  }

  // Scroll to active tab only when shouldScrollToActive is true (new day added)
  React.useEffect(() => {
    if (shouldScrollToActive && activeTab.startsWith('day')) {
      const dayNumber = parseInt(activeTab.replace('day', ''));
      // Find the index of the active tab in the tabs array
      const tabIndex = tabs.findIndex(tab => tab === activeTab);
      const scrollToX = tabIndex * 80; // Approximate tab width
      
      scrollViewRef.current?.scrollTo({
        x: scrollToX,
        animated: true,
      });
    }
  }, [activeTab, shouldScrollToActive, tabs]);

  return (
    <View style={usePrimaryStyle ? styles.primaryContainer : styles.tabBarContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={usePrimaryStyle ? styles.primaryScrollContent : styles.scrollContent}
        style={styles.scrollView}
      >
        {/* Render tabs in the provided order */}
        {tabs.map((tab, idx) => {
          const isDayTab = tab.startsWith('day');
          const dayNumber = isDayTab ? parseInt(tab.replace('day', '')) : 0;
          // Only show delete icon on first day (day 1) or last day
          const isFirstOrLastDay = dayNumber === 1 || dayNumber === dayCount;
          const showDeleteIcon = isDeleteMode && isDayTab && dayCount > 1 && isFirstOrLastDay;
          const isSelectedForReorder = selectedDayForReorder === tab;
          const showReorderIcon = reorderMode && isDayTab;

          const handlePress = () => {
            // Reorder mode disabled for now
            // if (reorderMode && isDayTab) {
            //   // In reorder mode, clicking a day either selects it or swaps with selected
            //   if (!selectedDayForReorder) {
            //     // Select this day for reordering
            //     setSelectedDayForReorder(tab);
            //   } else if (selectedDayForReorder === tab) {
            //     // Deselect if clicking the same day
            //     setSelectedDayForReorder(null);
            //   } else {
            //     // Swap the two days
            //     const fromDay = parseInt(selectedDayForReorder.replace('day', ''));
            //     const toDay = parseInt(tab.replace('day', ''));
            //     if (onReorderDays) {
            //       onReorderDays(fromDay, toDay);
            //     }
            //     setSelectedDayForReorder(null);
            //     setReorderMode(false);
            //   }
            // } else
            if (isDeleteMode && isDayTab && isFirstOrLastDay) {
              // Only allow deletion of first or last day - pass the day number directly
              onDeleteDay(dayNumber);
              setIsDeleteMode(false);
            } else if (isDeleteMode && isDayTab && !isFirstOrLastDay) {
              // Middle days cannot be deleted - just switch to the tab
              onTabChange(tab);
            } else {
              onTabChange(tab);
            }
          };

          return (
            <TouchableOpacity
              key={tab}
              style={[
                usePrimaryStyle ? styles.primaryTab : styles.tab,
                activeTab === tab && !reorderMode && (usePrimaryStyle ? styles.primaryTabActive : styles.activeTab),
                isSelectedForReorder && styles.selectedForReorder,
                showReorderIcon && !isSelectedForReorder && styles.reorderableTab
              ]}
              onPress={handlePress}
            >
              {showDeleteIcon && (
                <View style={styles.deleteIcon}>
                  <Ionicons name="remove-circle" size={16} color="#dc3545" />
                </View>
              )}
              {showReorderIcon && (
                <View style={styles.dragIcon}>
                  <Ionicons
                    name={isSelectedForReorder ? "swap-horizontal" : "reorder-three"}
                    size={16}
                    color={isSelectedForReorder ? Colors.PRIMARY : "#6B7280"}
                  />
                </View>
              )}
              <Text style={[
                usePrimaryStyle ? styles.primaryTabText : styles.tabText,
                activeTab === tab && !reorderMode && (usePrimaryStyle ? styles.primaryTabTextActive : styles.activeTabText),
                isSelectedForReorder && styles.selectedText
              ]}>
                {tab === 'overview'
                  ? 'Overview'
                  : tab === 'wishlist'
                  ? 'Wishlist'
                  : startDate
                    ? formatDayTab(startDate, parseInt(tab.replace('day', '')))
                    : `Day ${tab.replace('day', '')}`
                }
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Delete Mode Toggle Button - styled like a day tab, inside ScrollView */}
        {showDayButtons && currentUserRole !== 'viewer' && dayCount > 0 && (
          <TouchableOpacity
            style={[
              usePrimaryStyle ? styles.primaryActionButton : styles.tab,
              isDeleteMode && (usePrimaryStyle ? styles.primaryTabActive : styles.activeTab)
            ]}
            onPress={() => setIsDeleteMode(!isDeleteMode)}
          >
            <Ionicons
              name={isDeleteMode ? "close" : "remove-circle-outline"}
              size={16}
              color={isDeleteMode ? "#dc3545" : "#6B7280"}
            />
          </TouchableOpacity>
        )}

        {/* Add Day Button - styled like a day tab, inside ScrollView */}
        {showDayButtons && currentUserRole !== 'viewer' && (
          <TouchableOpacity
            style={[
              usePrimaryStyle ? styles.primaryActionButton : styles.tab,
            ]}
            onPress={onAddDay}
          >
            <Ionicons name="add" size={16} color={Colors.PRIMARY} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Primary style (for Overview/Itinerary toggle replacement)
  primaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.WHITE,
  },
  primaryScrollContent: {
    paddingHorizontal: 0,
    alignItems: 'center',
    gap: 6,
    flexDirection: 'row',
  },
  primaryTab: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 3,
    minWidth: 90,
  },
  primaryTabActive: {
    backgroundColor: '#E3F2FD',
    shadowColor: '#90CAF9',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  primaryTabText: {
    fontSize: 15,
    fontFamily: 'outfit-medium',
    color: '#6B7280',
    letterSpacing: -0.2,
  },
  primaryTabTextActive: {
    fontFamily: 'outfit-semibold',
    color: '#1976D2',
  },
  primaryActionButton: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 3,
    minWidth: 40,
  },
  // Original TabBar style (for secondary tabs)
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'black',
    overflow: 'hidden',
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    minWidth: 80, // Ensure tabs don't get too small
  },
  activeTab: {
    backgroundColor: '#f0f8ff', // Light blue background for active tab
  },
  tabText: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: Colors.GRAY,
  },
  activeTabText: {
    color: 'black',
    fontFamily: 'outfit',
    fontWeight: '600',
  },
  addDayButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4f8d4',
    borderLeftWidth: 1,
    borderLeftColor: 'black',
  },
  deleteDayButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffebee',
    borderLeftWidth: 1,
    borderLeftColor: 'black',
  },
  deleteIcon: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -8,
    zIndex: 1,
  },
  dragIcon: {
    position: 'absolute',
    right: 4,
    top: '50%',
    marginTop: -8,
    zIndex: 1,
  },
  draggingTab: {
    opacity: 0.5,
    transform: [{ scale: 1.05 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  hoverTab: {
    borderWidth: 2,
    borderColor: Colors.PRIMARY,
    borderStyle: 'dashed',
  },
  selectedForReorder: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: Colors.PRIMARY,
    transform: [{ scale: 1.05 }],
  },
  reorderableTab: {
    opacity: 0.8,
  },
  selectedText: {
    color: Colors.PRIMARY,
    fontWeight: '700',
  },
}); 
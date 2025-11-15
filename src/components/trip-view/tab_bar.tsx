import { Colors } from '../../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatDayTab } from '../../utils/dateFormatting';

type TabType = 'wishlist' | `day${number}`;

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  dayCount: number;
  onAddDay: () => void;
  onDeleteDay: () => void;
  shouldScrollToActive?: boolean;
  tabLabels?: TabType[];
  currentUserRole?: 'owner' | 'editor' | 'viewer';
  startDate?: string | null;
}

export function TabBar({ activeTab, onTabChange, dayCount, onAddDay, onDeleteDay, shouldScrollToActive = false, tabLabels, currentUserRole, startDate }: TabBarProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Generate tab order: use tabLabels if provided, otherwise default
  const tabs: TabType[] = tabLabels ?? ([
    'wishlist',
    ...Array.from({ length: dayCount }, (_, i) => `day${i + 1}` as TabType)
  ]);

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
    <View style={styles.tabBarContainer}>
      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* Render tabs in the provided order */}
        {tabs.map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => onTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'wishlist'
                ? 'WishList'
                : startDate
                  ? formatDayTab(startDate, parseInt(tab.replace('day', '')))
                  : `Day ${tab.replace('day', '')}`
              }
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Delete Day Button - Only show when activeTab is a day and user is not a viewer */}
      {activeTab.startsWith('day') && currentUserRole !== 'viewer' && (
        <TouchableOpacity
          style={styles.deleteDayButton}
          onPress={onDeleteDay}
        >
          <Ionicons name="remove" size={20} color="#dc3545" />
        </TouchableOpacity>
      )}
      
      {/* Add Day Button - Fixed position - hide for viewers */}
      {currentUserRole !== 'viewer' && (
        <TouchableOpacity
          style={styles.addDayButton}
          onPress={onAddDay}
        >
          <Ionicons name="add" size={20} color={Colors.PRIMARY} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
}); 
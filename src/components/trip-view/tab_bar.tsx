import { Colors } from '@/constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TabType = 'wishlist' | `day${number}`;

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  dayCount: number;
  onAddDay: () => void;
  shouldScrollToActive?: boolean;
  tabLabels?: TabType[];
}

export function TabBar({ activeTab, onTabChange, dayCount, onAddDay, shouldScrollToActive = false, tabLabels }: TabBarProps) {
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
              {tab === 'wishlist' ? 'WishList' : `Day ${tab.replace('day', '')}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Add Day Button - Fixed position */}
      <TouchableOpacity
        style={styles.addDayButton}
        onPress={onAddDay}
      >
        <Ionicons name="add" size={20} color={Colors.PRIMARY} />
      </TouchableOpacity>
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
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 1,
    borderLeftColor: 'black',
  },
}); 
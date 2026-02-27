import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';

function CustomTabBar({ state, descriptors, navigation }) {
  // Define the exact order we want: saved_places, create_new_trip, feed
  const tabOrder = ['saved_places', 'create_new_trip', 'feed'];

  // Only show visible tabs in our specified order
  const visibleRoutes = tabOrder
    .map(name => state.routes.find(route => route.name === name))
    .filter(Boolean);

  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBarContainer}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const routeIndex = state.routes.findIndex(r => r.key === route.key);
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Get icon based on route name
          const getIcon = () => {
            const iconColor = isFocused ? '#1a1a1a' : '#888';
            const iconSize = 24;

            switch (route.name) {
              case 'feed':
                return <Ionicons name={isFocused ? 'home' : 'home-outline'} size={iconSize} color={iconColor} />;
              case 'saved_places':
                return <Ionicons name={isFocused ? 'bookmark' : 'bookmark-outline'} size={iconSize} color={iconColor} />;
              case 'create_new_trip':
                return <Ionicons name="add" size={28} color={iconColor} />;
              default:
                return <Ionicons name="ellipse" size={iconSize} color={iconColor} />;
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[
                styles.tabButton,
                isFocused && styles.tabButtonActive,
              ]}
              activeOpacity={0.7}
            >
              {getIcon()}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen
        name="feed"
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="saved_places"
        options={{
          tabBarLabel: 'Saved',
        }}
      />
      <Tabs.Screen
        name="create_new_trip"
        options={{
          tabBarLabel: 'Create',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="mytrip"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 60,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 40,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  tabButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFD60A',
  },
});

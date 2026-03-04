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
            const iconColor = isFocused ? '#fff' : 'rgba(255, 255, 255, 0.5)';
            const iconSize = 22;

            switch (route.name) {
              case 'feed':
                return <Ionicons name={isFocused ? 'home' : 'home-outline'} size={iconSize} color={iconColor} />;
              case 'saved_places':
                return <Ionicons name={isFocused ? 'bookmark' : 'bookmark-outline'} size={iconSize} color={iconColor} />;
              case 'create_new_trip':
                return <Ionicons name="add" size={26} color={iconColor} />;
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
    bottom: Platform.OS === 'ios' ? 34 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 80,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 32,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  tabButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#F36406',
  },
});

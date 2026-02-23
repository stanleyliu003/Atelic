import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';

interface ProfileStatsProps {
  countriesVisited: number;
  citiesVisited: number;
  totalTrips: number;
  followersCount: number;
  followingCount: number;
  onFollowersPress: () => void;
  onFollowingPress: () => void;
}

export function ProfileStats({
  countriesVisited,
  citiesVisited,
  totalTrips,
  followersCount,
  followingCount,
  onFollowersPress,
  onFollowingPress,
}: ProfileStatsProps) {
  return (
    <View style={styles.container}>
      {/* Travel Stats Row */}
      <View style={styles.travelStatsRow}>
        <View style={styles.statItem}>
          <Ionicons name="earth" size={24} color={Colors.ORANGE} />
          <Text style={styles.statValue}>{countriesVisited}</Text>
          <Text style={styles.statLabel}>Countries</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statItem}>
          <Ionicons name="location" size={24} color={Colors.ORANGE} />
          <Text style={styles.statValue}>{citiesVisited}</Text>
          <Text style={styles.statLabel}>Cities</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statItem}>
          <Ionicons name="airplane" size={24} color={Colors.ORANGE} />
          <Text style={styles.statValue}>{totalTrips}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
      </View>

      {/* Separator */}
      <View style={styles.separator} />

      {/* Social Stats Row */}
      <View style={styles.socialStatsRow}>
        <TouchableOpacity style={styles.socialStatItem} onPress={onFollowersPress}>
          <Text style={styles.socialStatValue}>{followersCount}</Text>
          <Text style={styles.socialStatLabel}>Followers</Text>
        </TouchableOpacity>

        <View style={styles.verticalDivider} />

        <TouchableOpacity style={styles.socialStatItem} onPress={onFollowingPress}>
          <Text style={styles.socialStatValue}>{followingCount}</Text>
          <Text style={styles.socialStatLabel}>Following</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.WHITE,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  travelStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.BLACK,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.GRAY,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.LIGHT_GRAY,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.LIGHT_GRAY,
    marginVertical: 16,
  },
  socialStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  socialStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  socialStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.BLACK,
  },
  socialStatLabel: {
    fontSize: 14,
    color: Colors.GRAY,
    marginTop: 4,
  },
  verticalDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.LIGHT_GRAY,
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API, Storage } from 'aws-amplify';
import { Colors } from '../../../constants/Colors';
import { Activity, EnhancedRouteLeg } from '../../types/activity.types';
import EditableTripTitle from './EditableTripTitle';
import DaySummaryCard from './DaySummaryCard';
import { getUserProfile } from '../../graphql/queries';
import { InitialsAvatar } from '../common/InitialsAvatar';

// Helper function to resolve S3 keys to signed URLs
const resolveProfilePhotoUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;

  // If it's already a valid HTTP URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Otherwise, treat it as an S3 key (with or without 's3://' prefix)
  const s3Key = url.startsWith('s3://') ? url.replace('s3://', '') : url;

  try {
    const signedUrl = await Storage.get(s3Key, {
      level: 'public',
      expires: 3600
    });
    if (signedUrl && (signedUrl.startsWith('http://') || signedUrl.startsWith('https://'))) {
      return signedUrl;
    }
    return null;
  } catch (error) {
    console.error('[OverviewContent] Error getting signed URL:', error);
    return null;
  }
};

interface Collaborator {
  userID: string;
  email: string;
  role: string;
  userName?: string;
  username?: string;
  fullName?: string;
  profilePhotoUrl?: string;
}

interface OverviewContentProps {
  tripTitle: string | null;
  onTitleChange: (newTitle: string) => void;
  startDate: string | null;
  endDate: string | null;
  tripLength: number;
  selectedCity: string;
  dayActivities: { [dayNumber: number]: { activities: Activity[] } };
  activities: Activity[];
  onDayPress: (dayNumber: number) => void;
  onDatePress: () => void;
  currentUserRole: string;
  collaborators?: Collaborator[];
  dayRouteLegs?: { [dayNumber: number]: EnhancedRouteLeg[] };
  onCollaboratorsPress?: () => void;
}

export default function OverviewContent({
  tripTitle,
  onTitleChange,
  startDate,
  endDate,
  tripLength,
  selectedCity,
  dayActivities,
  activities,
  onDayPress,
  onDatePress,
  currentUserRole,
  collaborators,
  dayRouteLegs,
  onCollaboratorsPress,
}: OverviewContentProps) {
  const isViewer = currentUserRole === 'viewer';
  const [collaboratorPhotos, setCollaboratorPhotos] = useState<{ [username: string]: string | null }>({});

  // Fetch profile photos for collaborators
  useEffect(() => {
    const fetchCollaboratorPhotos = async () => {
      if (!collaborators || collaborators.length === 0) return;

      const photos: { [username: string]: string | null } = {};

      for (const collab of collaborators) {
        const username = collab.username || collab.userName;
        if (!username) continue;

        let photoUrl: string | null = null;

        // Check if already have photo URL in collaborator object
        if (collab.profilePhotoUrl) {
          photoUrl = collab.profilePhotoUrl;
        } else {
          try {
            const response = await API.graphql({
              query: getUserProfile,
              variables: { username },
            });
            const profile = (response as any).data?.getUserProfile;
            photoUrl = profile?.profilePhotoUrl || null;
          } catch (error) {
            // Try to extract from partial error
            const profile = (error as any)?.data?.getUserProfile;
            photoUrl = profile?.profilePhotoUrl || null;
          }
        }

        // Resolve S3 key to signed URL
        photos[username] = await resolveProfilePhotoUrl(photoUrl);
      }

      setCollaboratorPhotos(photos);
    };

    fetchCollaboratorPhotos();
  }, [collaborators]);

  const calculateDayDate = (startDate: string | null, dayNumber: number): Date | null => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + (dayNumber - 1));
    return dayDate;
  };

  const sortedDayNumbers = Object.keys(dayActivities)
    .map(Number)
    .sort((a, b) => a - b);

  // Calculate cumulative non-hotel activity counts for sequential numbering across days
  const activityNumberOffsets: { [dayNumber: number]: number } = {};
  let cumulativeCount = 0;
  sortedDayNumbers.forEach(dayNum => {
    activityNumberOffsets[dayNum] = cumulativeCount;
    const dayActs = dayActivities[dayNum]?.activities || [];
    const nonHotelCount = dayActs.filter(
      a => !(a.isLodging === true || a.primaryType === 'lodging')
    ).length;
    cumulativeCount += nonHotelCount;
  });

  // Calculate day date helper

  const formatDateRange = (): string => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startMonth = months[start.getMonth()];
      const endMonth = months[end.getMonth()];
      const startDay = start.getDate();
      const endDay = end.getDate();

      if (startMonth === endMonth && start.getFullYear() === end.getFullYear()) {
        return `${startMonth} ${startDay}-${endDay}`;
      }
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
    return `${tripLength} ${tripLength === 1 ? 'day' : 'days'}`;
  };

  // Calculate stats
  const totalLocations = sortedDayNumbers.reduce(
    (sum, dayNum) => sum + (dayActivities[dayNum]?.activities?.length || 0),
    0
  );
  const plannedDays = sortedDayNumbers.filter(
    dayNum => dayActivities[dayNum]?.activities?.length > 0
  ).length;
  const totalCollaborators = (collaborators?.length || 1) - 1; // Exclude owner

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Trip Header */}
      <View style={styles.headerSection}>
        <EditableTripTitle
          title={tripTitle}
          defaultTitle={selectedCity}
          onSave={onTitleChange}
          editable={!isViewer}
        />

        <View style={styles.metaRow}>
          <Pressable
            onPress={!isViewer ? onDatePress : undefined}
            disabled={isViewer}
            style={styles.dateContainer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
            <Text style={styles.dateText}>{formatDateRange()}</Text>
          </Pressable>

          <View style={styles.statsContainer}>
            <Pressable
              style={styles.collaboratorsContainer}
              onPress={onCollaboratorsPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {(collaborators || []).slice(0, 3).map((collab, index) => {
                const username = collab.username || collab.userName || '';
                const fullName = collab.fullName || collab.email || '';
                const photoUrl = collaboratorPhotos[username];

                return (
                  <View
                    key={collab.userID || index}
                    style={[
                      styles.collaboratorAvatar,
                      { marginLeft: index === 0 ? 0 : -8, zIndex: 10 - index },
                    ]}
                  >
                    <InitialsAvatar
                      name={fullName || username || '?'}
                      profilePhotoUrl={photoUrl}
                      size={28}
                      fontSize={11}
                    />
                  </View>
                );
              })}
              {(collaborators?.length || 0) > 3 && (
                <View style={[styles.collaboratorAvatar, { marginLeft: -8, zIndex: 6 }]}>
                  <View style={styles.moreCollaborators}>
                    <Text style={styles.moreText}>+{(collaborators?.length || 0) - 3}</Text>
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Days Section */}
      <View style={styles.daysSection}>
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>MY ITINERARY</Text>
        </View>

        {sortedDayNumbers.length > 0 ? (
          <View style={styles.daysContainer}>
            {sortedDayNumbers.map((dayNumber, index) => (
              <View key={dayNumber} style={[
                styles.dayCardWrapper,
                index === 0 && styles.firstDayCard
              ]}>
                <DaySummaryCard
                  dayNumber={dayNumber}
                  activities={dayActivities[dayNumber]?.activities || []}
                  date={calculateDayDate(startDate, dayNumber)}
                  onPress={() => onDayPress(dayNumber)}
                  routeLegs={dayRouteLegs?.[dayNumber]}
                  activityNumberOffset={activityNumberOffsets[dayNumber]}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="calendar-outline" size={32} color="#F36406" />
            </View>
            <Text style={styles.emptyTitle}>No days planned yet</Text>
            <Text style={styles.emptySubtext}>
              Switch to the Itinerary tab to start planning your trip days
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingBottom: 0,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontFamily: 'outfit',
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontFamily: 'outfit-semibold',
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#E5E7EB',
  },
  collaboratorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collaboratorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  moreCollaborators: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 10,
    fontFamily: 'outfit-bold',
    color: '#6B7280',
  },
  daysSection: {
    marginTop: 0,
    marginBottom: 0,
  },
  sectionHeaderContainer: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 0,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'outfit-bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 0,
  },
  daysContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  dayCardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8EAED',
    overflow: 'hidden',
  },
  firstDayCard: {
    // No special styling needed
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  emptyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'outfit-bold',
    color: '#111827',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'outfit',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

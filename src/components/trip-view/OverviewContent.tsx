import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { Activity, EnhancedRouteLeg } from '../../types/activity.types';
import { TripCity } from '../../types/city.types';
import EditableTripTitle from './EditableTripTitle';
import DaySummaryCard from './DaySummaryCard';

interface Collaborator {
  userID: string;
  email: string;
  role: string;
  userName?: string;
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
  cities?: TripCity[];
  dayCity?: { [dayNumber: number]: string };
  onAddCity?: () => void;
  onEditCityDates?: (city: TripCity) => void;
  onSwapDays?: (dayA: number, dayB: number) => void;
  onMoveDayToCity?: (dayNumber: number, cityId: string) => void;
}

// Color palette for city section headers (matches CitySelector)
const CITY_COLORS = ['#1976D2', '#E65100', '#2E7D32', '#6A1B9A', '#00695C', '#C62828'];

function formatCityDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  cities,
  dayCity,
  onAddCity,
  onEditCityDates,
  onSwapDays,
  onMoveDayToCity,
}: OverviewContentProps) {
  const isViewer = currentUserRole === 'viewer';
  const canEdit = !isViewer;

  // Which day is currently in "move mode"
  const [movingDay, setMovingDay] = React.useState<number | null>(null);

  const calculateDayDate = (startDate: string | null, dayNumber: number): Date | null => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const dayDate = new Date(start);
    dayDate.setUTCDate(start.getUTCDate() + (dayNumber - 1));
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

  const formatDateRange = (): string => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startMonth = months[start.getUTCMonth()];
      const endMonth = months[end.getUTCMonth()];
      const startDay = start.getUTCDate();
      const endDay = end.getUTCDate();
      if (startMonth === endMonth && start.getUTCFullYear() === end.getUTCFullYear()) {
        return `${startMonth} ${startDay} – ${endDay}`;
      }
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
    }
    if (tripLength) return `${tripLength} ${tripLength === 1 ? 'day' : 'days'}`;
    return '';
  };

  const dateRangeLabel = formatDateRange();

  // Calculate stats
  const totalLocations = sortedDayNumbers.reduce(
    (sum, dayNum) => sum + (dayActivities[dayNum]?.activities?.length || 0),
    0
  );
  const totalCollaborators = (collaborators?.length || 1);

  // Group days by city. When there are multiple cities, organise into per-city sections.
  // Days without an assignment fall under the first city (or a standalone section).
  const multiCity = (cities?.length ?? 0) > 1;

  interface DayGroup {
    city: TripCity | null;
    cityIndex: number;
    dayNumbers: number[];
  }

  const dayGroups: DayGroup[] = React.useMemo(() => {
    if (!multiCity || !cities || cities.length === 0) {
      return [{ city: cities?.[0] ?? null, cityIndex: 0, dayNumbers: sortedDayNumbers }];
    }

    const groups: DayGroup[] = cities.map((city, idx) => ({
      city,
      cityIndex: idx,
      dayNumbers: sortedDayNumbers.filter(d => {
        const assigned = dayCity?.[d];
        if (assigned) return assigned === city.cityId;
        // Unassigned days go to the first city by default
        return idx === 0;
      }),
    }));

    // If there are days not assigned to any known city, add an "Other" bucket
    const knownCityIds = new Set(cities.map(c => c.cityId));
    const orphanDays = sortedDayNumbers.filter(d => {
      const assigned = dayCity?.[d];
      return assigned && !knownCityIds.has(assigned);
    });
    if (orphanDays.length > 0) {
      groups.push({ city: null, cityIndex: cities.length, dayNumbers: orphanDays });
    }

    return groups;
  }, [multiCity, cities, sortedDayNumbers, dayCity]);

  // Given a day number and the full sorted list for its group, return the adjacent days
  const getAdjacentInGroup = (dayNumber: number, groupDays: number[]) => {
    const idx = groupDays.indexOf(dayNumber);
    return {
      prev: idx > 0 ? groupDays[idx - 1] : null,
      next: idx < groupDays.length - 1 ? groupDays[idx + 1] : null,
    };
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      // Dismiss move-mode when scrolling away
      onScrollBeginDrag={() => setMovingDay(null)}
    >
      {/* ── Trip Header ─────────────────────────────── */}
      <View style={styles.headerSection}>
        <EditableTripTitle
          title={tripTitle}
          defaultTitle={selectedCity}
          onSave={onTitleChange}
          editable={canEdit}
        />

        <View style={styles.metaRow}>
          {/* Date range — tappable to open date picker */}
          <Pressable
            onPress={!isViewer ? onDatePress : undefined}
            disabled={isViewer}
            style={styles.dateContainer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
            {dateRangeLabel ? (
              <Text style={styles.dateText}>{dateRangeLabel}</Text>
            ) : (
              <Text style={[styles.dateText, styles.datePlaceholder]}>
                {canEdit ? 'Add dates' : 'No dates set'}
              </Text>
            )}
          </Pressable>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="location" size={12} color="#9CA3AF" />
              <Text style={styles.statText}>{totalLocations}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="people" size={12} color="#9CA3AF" />
              <Text style={styles.statText}>{totalCollaborators}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Cities Row ────────── */}
      <View style={styles.citiesSection}>
        {cities && cities.length > 0 && (
          <>
            <View style={styles.citiesSectionHeader}>
              <Text style={styles.sectionLabel}>CITIES</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.citiesScroll}
            >
              {cities.map((city, idx) => {
                const displayStart = city.startDate || (idx === 0 ? startDate : null);
                const displayEnd = city.endDate || (idx === 0 ? endDate : null);
                const hasDate = displayStart || displayEnd;
                const accent = CITY_COLORS[idx % CITY_COLORS.length];
                return (
                  <TouchableOpacity
                    key={city.cityId}
                    style={[styles.cityCard, { borderColor: accent + '40' }]}
                    onPress={canEdit && onEditCityDates ? () => onEditCityDates(city) : undefined}
                    activeOpacity={canEdit ? 0.7 : 1}
                  >
                    <View style={[styles.cityCardIndex, { backgroundColor: accent }]}>
                      <Text style={styles.cityCardIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.cityCardBody}>
                      <Text style={styles.cityCardName} numberOfLines={1}>{city.name}</Text>
                      {hasDate ? (
                        <Text style={styles.cityCardDate}>
                          {formatCityDate(displayStart)}
                          {displayStart && displayEnd ? ' – ' : ''}
                          {formatCityDate(displayEnd)}
                        </Text>
                      ) : (
                        <Text style={[styles.cityCardDate, { color: canEdit ? '#93C5FD' : '#D1D5DB' }]}>
                          {canEdit ? 'Tap to add dates' : 'No dates'}
                        </Text>
                      )}
                    </View>
                    {canEdit && onEditCityDates && (
                      <Ionicons name="chevron-forward" size={14} color="#C7D2FE" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Standalone Add City button — always visible to editors */}
        {canEdit && onAddCity && (
          <TouchableOpacity
            style={styles.addCityButton}
            onPress={onAddCity}
            activeOpacity={0.75}
          >
            <View style={styles.addCityButtonIcon}>
              <Ionicons name="add" size={18} color="#1976D2" />
            </View>
            <Text style={styles.addCityButtonText}>Add City</Text>
            <Ionicons name="chevron-forward" size={16} color="#93C5FD" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Itinerary days grouped by city ────────────── */}
      <View style={styles.daysSection}>
        {sortedDayNumbers.length > 0 ? (
          <>
            {dayGroups.map((group) => {
              if (group.dayNumbers.length === 0) return null;
              const accent = CITY_COLORS[group.cityIndex % CITY_COLORS.length];
              const otherCities = (cities || []).filter(c => c.cityId !== group.city?.cityId);

              return (
                <View key={group.city?.cityId ?? 'unassigned'}>
                  {/* City section header — shown whenever cities exist */}
                  {cities && cities.length > 0 && (
                    <View style={[styles.citySectionHeader, { backgroundColor: accent + '12' }]}>
                      <View style={[styles.citySectionLeftBar, { backgroundColor: accent }]} />
                      <View style={styles.citySectionHeaderInner}>
                        <View style={[styles.citySectionBadge, { backgroundColor: accent }]}>
                          <Text style={styles.citySectionBadgeText}>{group.cityIndex + 1}</Text>
                        </View>
                        <View style={styles.citySectionTextBlock}>
                          <View style={styles.citySectionNameRow}>
                            <Ionicons name="location" size={13} color={accent} />
                            <Text style={[styles.citySectionName, { color: accent }]} numberOfLines={1}>
                              {group.city?.name ?? 'Unassigned'}
                            </Text>
                          </View>
                          <View style={styles.citySectionSubRow}>
                            {(group.city?.startDate || group.city?.endDate) && (
                              <Text style={styles.citySectionDates}>
                                {formatCityDate(group.city?.startDate)}
                                {group.city?.startDate && group.city?.endDate ? ' – ' : ''}
                                {formatCityDate(group.city?.endDate)}
                              </Text>
                            )}
                            {group.dayNumbers.length > 0 && (
                              <>
                                {(group.city?.startDate || group.city?.endDate) && (
                                  <View style={styles.citySectionDot} />
                                )}
                                <Text style={styles.citySectionDayRange}>
                                  {group.dayNumbers.length === 1
                                    ? `Day ${group.dayNumbers[0]}`
                                    : `Days ${group.dayNumbers[0]}–${group.dayNumbers[group.dayNumbers.length - 1]}`}
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Day cards */}
                  <View style={[styles.daysContainer, multiCity && styles.daysContainerInset]}>
                    {group.dayNumbers.map((dayNumber) => {
                      const { prev, next } = getAdjacentInGroup(dayNumber, group.dayNumbers);
                      const isMoving = movingDay === dayNumber;

                      return (
                        <View
                          key={dayNumber}
                          style={[styles.dayCardWrapper, isMoving && styles.dayCardWrapperMoving]}
                        >
                          <DaySummaryCard
                            dayNumber={dayNumber}
                            activities={dayActivities[dayNumber]?.activities || []}
                            date={calculateDayDate(startDate, dayNumber)}
                            onPress={() => {
                              if (isMoving) { setMovingDay(null); return; }
                              onDayPress(dayNumber);
                            }}
                            routeLegs={dayRouteLegs?.[dayNumber]}
                            activityNumberOffset={activityNumberOffsets[dayNumber]}
                          />

                          {/* Reorder controls — shown when this card is in move mode */}
                          {isMoving && canEdit && (
                            <View style={styles.moveControls}>
                              {/* Within-city position arrows */}
                              <View style={styles.moveArrows}>
                                <TouchableOpacity
                                  style={[styles.arrowBtn, !prev && styles.arrowBtnDisabled]}
                                  onPress={() => prev !== null && onSwapDays?.(dayNumber, prev)}
                                  disabled={prev === null}
                                >
                                  <Ionicons name="arrow-up" size={16} color={prev !== null ? '#1976D2' : '#D1D5DB'} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.arrowBtn, !next && styles.arrowBtnDisabled]}
                                  onPress={() => next !== null && onSwapDays?.(dayNumber, next)}
                                  disabled={next === null}
                                >
                                  <Ionicons name="arrow-down" size={16} color={next !== null ? '#1976D2' : '#D1D5DB'} />
                                </TouchableOpacity>
                              </View>

                              {/* Move-to-city chips — only shown in multi-city trips */}
                              {multiCity && otherCities.length > 0 && (
                                <View style={styles.moveCityRow}>
                                  <Text style={styles.moveCityLabel}>Move to:</Text>
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {otherCities.map((c, i) => {
                                      const chipColor = CITY_COLORS[
                                        (cities || []).findIndex(x => x.cityId === c.cityId) % CITY_COLORS.length
                                      ];
                                      return (
                                        <TouchableOpacity
                                          key={c.cityId}
                                          style={[styles.moveCityChip, { borderColor: chipColor }]}
                                          onPress={() => {
                                            onMoveDayToCity?.(dayNumber, c.cityId);
                                            setMovingDay(null);
                                          }}
                                        >
                                          <Text style={[styles.moveCityChipText, { color: chipColor }]}>
                                            {c.name}
                                          </Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </ScrollView>
                                </View>
                              )}

                              {/* Done button */}
                              <TouchableOpacity
                                style={styles.moveDoneBtn}
                                onPress={() => setMovingDay(null)}
                              >
                                <Ionicons name="checkmark" size={14} color="#fff" />
                                <Text style={styles.moveDoneBtnText}>Done</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {/* Drag handle — always visible for editors, bottom-right of card */}
                          {canEdit && !isMoving && (
                            <TouchableOpacity
                              style={styles.dragHandle}
                              onPress={() => setMovingDay(dayNumber)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="reorder-three" size={18} color="#D1D5DB" />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </>
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
    paddingBottom: 24,
  },

  // ── Header ──────────────────────────────────────────
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
  datePlaceholder: {
    color: '#1976D2',
    textDecorationLine: 'underline',
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

  // ── Cities row ──────────────────────────────────────
  citiesSection: {
    marginTop: 4,
  },
  citiesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'outfit-bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addCityInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addCityInlineText: {
    fontSize: 13,
    fontFamily: 'outfit-medium',
    color: '#1976D2',
  },
  citiesScroll: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    minWidth: 140,
  },
  cityCardIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityCardIndexText: {
    fontSize: 12,
    fontFamily: 'outfit-bold',
    color: '#fff',
  },
  cityCardBody: {
    flex: 1,
  },
  cityCardName: {
    fontSize: 14,
    fontFamily: 'outfit-semibold',
    color: '#111827',
  },
  cityCardDate: {
    fontSize: 11,
    fontFamily: 'outfit',
    color: '#6B7280',
    marginTop: 2,
  },
  addCityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#EBF5FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#90CAF9',
    borderStyle: 'dashed',
    gap: 10,
  },
  addCityButtonIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCityButtonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'outfit-semibold',
    color: '#1976D2',
  },

  // ── Days section ────────────────────────────────────
  daysSection: {
    marginTop: 4,
  },

  // City section header (location banner)
  citySectionHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  citySectionLeftBar: {
    width: 4,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  citySectionHeaderInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  citySectionBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  citySectionBadgeText: {
    fontSize: 12,
    fontFamily: 'outfit-bold',
    color: '#fff',
  },
  citySectionTextBlock: {
    flex: 1,
    gap: 2,
  },
  citySectionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  citySectionName: {
    fontSize: 14,
    fontFamily: 'outfit-bold',
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  citySectionSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  citySectionDates: {
    fontSize: 11,
    fontFamily: 'outfit',
    color: '#6B7280',
  },
  citySectionDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D1D5DB',
  },
  citySectionDayRange: {
    fontSize: 11,
    fontFamily: 'outfit-medium',
    color: '#9CA3AF',
  },

  daysContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  daysContainerInset: {
    paddingLeft: 16, // same as base — banner header provides visual grouping without indent
  },
  dayCardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8EAED',
    overflow: 'hidden',
    position: 'relative',
  },
  dayCardWrapperMoving: {
    borderColor: '#1976D2',
    borderWidth: 1.5,
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },

  // Drag handle overlay (bottom-right of card)
  dragHandle: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    padding: 4,
    opacity: 0.6,
  },

  // Inline move controls (shown when card is in move mode)
  moveControls: {
    backgroundColor: '#F0F7FF',
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  moveArrows: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  moveCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moveCityLabel: {
    fontSize: 12,
    fontFamily: 'outfit-medium',
    color: '#6B7280',
    flexShrink: 0,
  },
  moveCityChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 6,
    backgroundColor: '#fff',
  },
  moveCityChipText: {
    fontSize: 12,
    fontFamily: 'outfit-semibold',
  },
  moveDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#1976D2',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 5,
  },
  moveDoneBtnText: {
    fontSize: 13,
    fontFamily: 'outfit-semibold',
    color: '#fff',
  },

  // ── Empty state ─────────────────────────────────────
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

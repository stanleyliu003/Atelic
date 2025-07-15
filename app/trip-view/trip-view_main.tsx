import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { encodePolyline } from '../../src/utils/polyline';
import { DaySchedule, TabBar, WishlistActivities } from '../../src/components/trip-view';
import { TripMapView } from '../../src/components/trip-view/map_view';
import { TransferActivitiesModal } from '../../src/components/trip-view/transfer_activities_modal';
import { TransferButtonContainer } from '../../src/components/trip-view/transfer_delete_button_containor';
import { useActivitySelection } from '../../src/hooks/use_activity_selection';
import { useDayActivities } from '../../src/hooks/use_day_activities';
import { useTransferActivities } from '../../src/hooks/use_transfer_activities';
import { fetchRoutePolyline, RouteData } from '../../src/services/getRoute_graphQL_call';
import { fetchOptimizedRoute } from '../../src/services/optimize_route_graphQL_call';
import { Activity, TabType } from '../../src/types/activity.types';

export default function TripViewMain() {
    const router = useRouter();
    const navigation = useNavigation();
    const { activities, removeActivities, setDayPolyline } = useCreateTrip();
    const [activeTab, setActiveTab] = useState<TabType>('wishlist');
    const [shouldScrollToActive, setShouldScrollToActive] = useState(false);
    const [routeData, setRouteData] = useState<RouteData>({
        polyline: [],
        legs: [],
        totalDistance: 0,
        totalDuration: ''
    });
    const [routeLoading, setRouteLoading] = useState(false);
    const routeCache = useRef<{ [tab: string]: { activitiesHash: string, routeData: RouteData } }>({});

    // Hooks for activity and day management
    const {
        selectedActivities,
        isSelectionMode,
        toggleActivitySelection,
        clearSelection,
        getSelectedActivities,
    } = useActivitySelection();

    const {
        dayActivities,
        transferActivitiesToDay,
        transferActivitiesToWishlist,
        removeActivitiesFromAllDays,
        getDayActivities,
        getDayCount,
        addNewDay,
        reorderDayActivities,
    } = useDayActivities();

    // Define handleTabChange before using it in the hook
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        // Don't auto-scroll for manual tab selection
        setShouldScrollToActive(false);
        clearSelection(); // Clear selection when switching tabs
    };

    // Remove local state and handlers for transfer modal and related logic
    // Use the custom hook for all transfer modal and activity transfer logic
    const {
        isModalVisible,
        setIsModalVisible,
        selectedDay,
        setSelectedDay,
        daysArray,
        handleOpenTransferModal,
        handleConfirmTransfer,
        handleTransferToWishlist,
    } = useTransferActivities({
        activities: activities || [],
        activeTab,
        getSelectedActivities,
        transferActivitiesToDay,
        transferActivitiesToWishlist,
        clearSelection,
        getDayCount,
        onTabChange: handleTabChange, // Pass the tab change handler
    });

    // Get activities for the current tab
    const getActivitiesForTab = (tab: TabType) => {
        if (tab === 'wishlist') {
            // Filter out activities that are already in days
            const dayActivityIds = Object.values(dayActivities)
                .flatMap(dayObj => dayObj.activities)
                .map((activity: Activity) => activity.place_id)
                .filter(Boolean);
            
            return (activities || []).filter((activity: Activity) => 
                !activity.place_id || !dayActivityIds.includes(activity.place_id)
            );
        } else {
            // Extract day number from tab (e.g., 'day2' -> 2)
            const dayNumber = parseInt(tab.replace('day', ''));
            return getDayActivities(dayNumber);
        }
    };

    // Helper to hash activities for cache key
    function hashActivities(activities: Activity[]): string {
        // Simple hash: JSON stringify names/lat/lng only, sorted for determinism
        return JSON.stringify(
            activities
                .map(a => ({ name: a.name, lat: a.lat, lng: a.lng }))
                .sort((a, b) => a.name.localeCompare(b.name))
        );
    }

    // Fetch route data when activities or activeTab changes
    useEffect(() => {
        setRouteData({
            polyline: [],
            legs: [],
            totalDistance: 0,
            totalDuration: ''
        });
        if (!activeTab.startsWith('day')) {
            setRouteLoading(false);
            return;
        }
        setRouteLoading(true);
        const fetchRoute = async () => {
            const currentTabActivities = getActivitiesForTab(activeTab);
            const activitiesHash = hashActivities(currentTabActivities);
            const cached = routeCache.current[activeTab];
            if (cached && cached.activitiesHash === activitiesHash) {
                setRouteData(cached.routeData);
                setRouteLoading(false);
                // Store encoded polyline in context if available
                if (cached.routeData.polyline && cached.routeData.polyline.length > 1) {
                    const dayNumber = parseInt(activeTab.replace('day', ''));
                    const encoded = encodePolyline(cached.routeData.polyline);
                    setDayPolyline(dayNumber, encoded);
                }
                return;
            }
            const newRouteData = await fetchRoutePolyline(currentTabActivities);
            setRouteData(newRouteData);
            // Update cache
            routeCache.current[activeTab] = {
                activitiesHash,
                routeData: newRouteData,
            };
            // Store encoded polyline in context if available
            if (newRouteData.polyline && newRouteData.polyline.length > 1) {
                const dayNumber = parseInt(activeTab.replace('day', ''));
                const encoded = encodePolyline(newRouteData.polyline);
                setDayPolyline(dayNumber, encoded);
            }
            setRouteLoading(false);
        };
        fetchRoute();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activities, dayActivities]);

    // Invalidate cache for a day if its activities change
    useEffect(() => {
        // For each day tab, check if activities changed
        daysArray.forEach((d) => {
            if (typeof d === 'number') {
                const tab = `day${d}`;
                const acts = getDayActivities(d);
                const hash = hashActivities(acts);
                const cached = routeCache.current[tab];
                if (cached && cached.activitiesHash !== hash) {
                    delete routeCache.current[tab];
                }
            }
        });
    }, [dayActivities, activities, daysArray]);

    // Get all available days as an array, and add 'wishlist' as the last option
    const dayCount = getDayCount();

    // Prepare tab order: wishlist first, then all days
    const tabLabels: TabType[] = [
        'wishlist',
        ...daysArray.filter((d): d is number => typeof d === 'number').map(d => `day${d}` as TabType)
    ];

    // Placeholder: implement this to call your backend or Google Places API
    async function fetchActivityDetailsByPlaceId(place_id: string) {
        // TODO: Replace with actual API call to your backend or Google Places API
        // Return an object with at least: rating, photo_reference, and any other fields you want to refresh
        return {};
    }

    const handleOptimizeRoute = async (dayNumber: number) => {
        try {
            setRouteLoading(true);
            // 1. Get current day's activities
            const currentActivities = getDayActivities(dayNumber);
            if (!currentActivities || currentActivities.length < 2) {
                setRouteLoading(false);
                return;
            }
            // 2. Call optimizeRoute Lambda via GraphQL
            const { result: reordered, wasCached } = await fetchOptimizedRoute(currentActivities);
            if (!Array.isArray(reordered) || reordered.length < 2) {
                setRouteLoading(false);
                return;
            }
            // Show notification if route was already optimized
            if (wasCached) {
                alert('Route has already been optimized');
            }
            // 3. Reorder the full activity objects using the new order from optimizeRoute
            let reorderedFull = reordered.map(optAct => {
                if (optAct.place_id) {
                    return currentActivities.find(a => a.place_id === optAct.place_id) || optAct;
                }
                // fallback to name if no place_id
                return currentActivities.find(a => a.name === optAct.name) || optAct;
            });
            // 4. For any activity missing rating or photo_reference, fetch latest details
            reorderedFull = await Promise.all(reorderedFull.map(async (act) => {
                if (act.place_id && (act.rating == null || !act.photo_reference)) {
                    const details = await fetchActivityDetailsByPlaceId(act.place_id);
                    return { ...act, ...details };
                }
                return act;
            }));
            // 5. Update the activities for this day
            reorderDayActivities(dayNumber, reorderedFull);
            // 6. Call getRoute Lambda via GraphQL for the new order
            const newRouteData = await fetchRoutePolyline(reorderedFull);
            // 7. Update the route data for this day/tab
            if (activeTab === `day${dayNumber}`) {
                setRouteData(newRouteData);
            }
            setRouteLoading(false);
        } catch (err) {
            setRouteLoading(false);
            console.error('Error optimizing route:', err);
            // Optionally show a user-facing error message here
        }
    };

    const handleAddDay = () => {
        const newDayNumber = addNewDay();
        // Switch to the newly created day
        setActiveTab(`day${newDayNumber}`);
        // Trigger auto-scroll to the new day
        setShouldScrollToActive(true);
    };

    const handleDeleteActivities = () => {
        if (selectedActivities.length === 0) return;

        // Remove from CreateTripContext (master list)
        removeActivities(selectedActivities);
        
        // Remove from all days
        removeActivitiesFromAllDays(selectedActivities);
        
        // Clear selection
        clearSelection();
    };

    // Reset shouldScrollToActive after it's been used
    React.useEffect(() => {
        if (shouldScrollToActive) {
            setShouldScrollToActive(false);
        }
    }, [shouldScrollToActive]);

    useEffect(() => {
        navigation.setOptions({
          headerShown: false
        });
    }, []);

    return (
        <View style={styles.container}>
            <TripMapView 
                activities={getActivitiesForTab(activeTab)} 
                activeTab={activeTab}
                routeCoordinates={activeTab.startsWith('day') ? routeData.polyline : []}
                routeLoading={routeLoading}
                selectedActivities={selectedActivities}
            />

            <TabBar 
                activeTab={activeTab}
                onTabChange={handleTabChange}
                dayCount={getDayCount()}
                onAddDay={handleAddDay}
                shouldScrollToActive={shouldScrollToActive}
                tabLabels={tabLabels}
            />

            {/* Tab Content */}
            <View style={styles.tabContent}>
                {activeTab === 'wishlist' && (
                    <WishlistActivities 
                        activities={getActivitiesForTab('wishlist')}
                        selectedActivities={selectedActivities}
                        onActivitySelect={toggleActivitySelection}
                        onActivityDeselect={toggleActivitySelection}
                        showSelectionIndicator={isSelectionMode}
                    />
                )}
                
                {activeTab.startsWith('day') && (
                    <DaySchedule 
                        dayNumber={parseInt(activeTab.replace('day', ''))}
                        activities={getActivitiesForTab(activeTab)}
                        selectedActivities={selectedActivities}
                        onActivitySelect={toggleActivitySelection}
                        onActivityDeselect={toggleActivitySelection}
                        onTransferToWishlist={handleTransferToWishlist}
                        onOptimizeRoute={handleOptimizeRoute}
                        showSelectionIndicator={isSelectionMode}
                        routeLegs={routeData.legs}
                    />
                )}
            </View>

            {/* Transfer Button Container */}
            <TransferButtonContainer
                activeTab={activeTab}
                isSelectionMode={isSelectionMode}
                selectedActivities={selectedActivities}
                onTransferPress={handleOpenTransferModal}
                onDeletePress={handleDeleteActivities}
            />

            {/* Publish Trip Button - Only show on last day with activities and no selection */}
            {activeTab.startsWith('day') && (() => {
                const currentDayNumber = parseInt(activeTab.replace('day', ''));
                const currentDayActivities = getDayActivities(currentDayNumber);
                const isLastDay = currentDayNumber === getDayCount();
                const hasActivities = currentDayActivities && currentDayActivities.length > 0;
                const noSelection = selectedActivities.length === 0;
                
                if (isLastDay && hasActivities && noSelection) {
                    return (
                        <TouchableOpacity 
                            style={styles.publishButton}
                            onPress={() => {
                                // Get the last activity data to pass to the success page
                                const dayCount = getDayCount();
                                const lastDayActivities = getDayActivities(dayCount);
                                const lastActivity = lastDayActivities && lastDayActivities.length > 0 
                                    ? lastDayActivities[lastDayActivities.length - 1] 
                                    : null;
                                
                                router.push({
                                    pathname: '/trip-view/publish_success',
                                    params: {
                                        dayCount: dayCount.toString(),
                                        lastActivityPhotoRef: lastActivity?.photo_reference || ''
                                    }
                                });
                            }}
                        >
                            <Text style={styles.publishButtonText}>Save Trip</Text>
                        </TouchableOpacity>
                    );
                }
                return null;
            })()}

            {/* Transfer Modal */}
            <TransferActivitiesModal
                visible={isModalVisible}
                daysArray={daysArray}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onConfirm={handleConfirmTransfer}
                onClose={() => setIsModalVisible(false)}
            />

            <TouchableOpacity style={styles.backButton} onPress={() => router.push('/create-trip/wishlist_info')}>
                <Ionicons name="arrow-back-circle-sharp" size={40} color={Colors.PRIMARY} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.WHITE,
    },
    backButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 1, // Ensure it's above the map
        backgroundColor: 'white',
        borderRadius: 20,
    },
    tabContent: {
        flex: 1,
        marginTop: 0,
        marginHorizontal: 20,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        marginBottom: 40, // Space for transfer button
    },
    publishButton: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: Colors.PRIMARY,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    publishButtonText: {
        color: Colors.WHITE,
        fontSize: 18,
        fontFamily: 'outfit-bold',
        fontWeight: '600',
    },
});
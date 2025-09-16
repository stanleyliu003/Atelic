import { Colors } from '../../constants/Colors';
import { API_KEYS } from '../../constants/ApiKeys';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useCreateTrip } from '../../context/CreateTripContext';
import { encodePolyline } from '../../src/utils/polyline';
import { AddPlacesButton, DaySchedule, TabBar, WishlistActivities } from '../../src/components/trip-view';
import { TripMapView } from '../../src/components/trip-view/map_view';
import { TransferActivitiesModal } from '../../src/components/trip-view/transfer_activities_modal';
import { TransferButtonContainer } from '../../src/components/trip-view/transfer_delete_button_containor';
import { ActivityDetailView } from '../../src/components/trip-view/description_card';
import { useActivitySelection } from '../../src/hooks/use_activity_selection';
import { useDayActivities } from '../../src/hooks/use_day_activities';
import { useTransferActivities } from '../../src/hooks/use_transfer_activities';
import { fetchRoutePolyline, RouteData } from '../../src/services/getRoute_graphQL_call';
import { optimizeRouteWithHaversine } from '../../src/components/trip-view/logic/optimize_route';
import { Activity, TabType } from '../../src/types/activity.types';
import { API, graphqlOperation } from 'aws-amplify';
import { createTrip } from '../../src/graphql/mutations';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Entypo from '@expo/vector-icons/Entypo';


export default function TripViewMain() {
    const router = useRouter();
    const navigation = useNavigation();
    const params = useLocalSearchParams();
    const { restoreTrip } = params;
    const { activities, removeActivities, setDayPolyline, tripId, wishlistText, dayPolylines, updateActivities, setTripId, restoreTripFromObject, createdAt, setCreatedAt, tripLength, setDayPolylinesDeleteDay, selectedCity } = useCreateTrip();
    const [activeTab, setActiveTab] = useState<TabType>('wishlist');
    const [shouldScrollToActive, setShouldScrollToActive] = useState(false);
    const [routeData, setRouteData] = useState<RouteData>({
        polyline: [],
        legs: [],
        totalDistance: 0,
        totalDuration: '',
        travelMode: 'DRIVE'
    });
    const [routeLoading, setRouteLoading] = useState(false);
    const routeCache = useRef<{ [tab: string]: { activitiesHash: string, routeData: RouteData } }>({});
    
    // State for add places modal
    const [isAddPlacesModalVisible, setIsAddPlacesModalVisible] = useState(false);
    const [isAddingPlace, setIsAddingPlace] = useState(false);

    // State for activity detail view
    const [selectedActivityForDetail, setSelectedActivityForDetail] = useState<Activity | null>(null);
    const [showActivityDetail, setShowActivityDetail] = useState(false);
    
    // State for selected marker
    const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
    
    // State for scroll positions per day
    const [dayScrollPositions, setDayScrollPositions] = useState<{ [key: number]: number }>({});
    const [shouldRestoreScrollPositions, setShouldRestoreScrollPositions] = useState<{ [key: number]: boolean }>({});

    // Handler for scroll position changes
    const handleScrollPositionChange = (dayNumber: number, position: number) => {
        setDayScrollPositions(prev => ({
            ...prev,
            [dayNumber]: position
        }));
    };

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
        addMultipleDays,
        reorderDayActivities,
        deleteDayAndRenumber,
        addActivityToDay,
    } = useDayActivities();
    
    // Initialize days based on tripLength (only for new trips, not existing ones)
    const [hasInitialized, setHasInitialized] = useState(false);
    useEffect(() => {
        // Only initialize days once when the component first mounts
        if (!hasInitialized) {
            if (tripLength && tripLength > 0 && getDayCount() === 0) {
                // Create all days at once based on tripLength
                addMultipleDays(tripLength);
            } else if (!tripLength && getDayCount() === 0) {
                // Fallback: create day 1 if tripLength is not set
                addNewDay();
            }
            setHasInitialized(true);
        }
    }, [tripLength, getDayCount, addNewDay, addMultipleDays, hasInitialized]);

    // Define handleTabChange before using it in the hook
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        // Don't auto-scroll for manual tab selection
        setShouldScrollToActive(false);
        clearSelection(); // Clear selection when switching tabs
        // Clear selected marker when switching tabs
        setSelectedMarker(null);
        
        // Trigger scroll restoration for the new active tab if it's a day tab
        if (tab.startsWith('day')) {
            const dayNumber = parseInt(tab.replace('day', ''));
            setShouldRestoreScrollPositions(prev => ({
                ...prev,
                [dayNumber]: true
            }));
            // Reset the flag after restoration
            setTimeout(() => {
                setShouldRestoreScrollPositions(prev => ({
                    ...prev,
                    [dayNumber]: false
                }));
            }, 100);
        }
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
                .flatMap(dayObj => Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : [])
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
            totalDuration: '',
            travelMode: 'DRIVE'
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
            // 2. Use local Haversine optimization (FREE)
            const { result: reordered, wasCached } = optimizeRouteWithHaversine(currentActivities);
            if (!Array.isArray(reordered) || reordered.length < 2) {
                setRouteLoading(false);
                return;
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
            // 7. Update the route cache for this day regardless of active tab
            const dayTab = `day${dayNumber}`;
            const activitiesHash = hashActivities(reorderedFull);
            routeCache.current[dayTab] = {
                activitiesHash,
                routeData: newRouteData,
            };
            // 8. Update the route data if this is the currently active tab
            if (activeTab === dayTab) {
                setRouteData(newRouteData);
            }
            // 9. Store encoded polyline in context for the optimized route
            if (newRouteData.polyline && newRouteData.polyline.length > 1) {
                const encoded = encodePolyline(newRouteData.polyline);
                setDayPolyline(dayNumber, encoded);
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

    const handleDeleteDay = () => {
        // Only allow deletion if activeTab is a day (not wishlist)
        if (!activeTab.startsWith('day')) return;
        
        const dayToDelete = parseInt(activeTab.replace('day', ''));
        
        // Delete the day and get its activities to move back to wishlist
        const deletedDayActivities = deleteDayAndRenumber(dayToDelete);
        
        // Add deleted day activities back to wishlist (with deduplication)
        if (deletedDayActivities.length > 0) {
            const combinedActivities = [...activities, ...deletedDayActivities];
            
            // Remove duplicates based on place_id
            const deduplicatedActivities = combinedActivities.filter((activity, index, arr) => {
                if (!activity.place_id) return true; // Keep activities without place_id
                // Keep only the first occurrence of each place_id
                return arr.findIndex(a => a.place_id === activity.place_id) === index;
            });
            
            updateActivities(deduplicatedActivities);
        }
        
        // Clear route cache for days that got renumbered
        Object.keys(routeCache.current).forEach(cacheKey => {
            if (cacheKey.startsWith('day')) {
                const cachedDayNum = parseInt(cacheKey.replace('day', ''));
                if (cachedDayNum >= dayToDelete) {
                    delete routeCache.current[cacheKey];
                }
            }
        });
        
        // Update dayPolylines to renumber the keys
        setDayPolylinesDeleteDay(prev => {
            const newPolylines: { [key: number]: string } = {};
            Object.entries(prev).forEach(([dayStr, polyline]) => {
                const dayNum = Number(dayStr);
                if (dayNum < dayToDelete) {
                    // Keep days before the deleted day as-is
                    newPolylines[dayNum] = polyline as string;
                } else if (dayNum > dayToDelete) {
                    // Renumber days after the deleted day
                    newPolylines[dayNum - 1] = polyline as string;
                }
                // Skip the deleted day (dayNum === dayToDelete)
            });
            return newPolylines;
        });
        
        // Switch to appropriate tab after deletion
        const remainingDayCount = getDayCount() - 1; // Count after deletion
        if (remainingDayCount === 0 || dayToDelete === 1) {
            // If no days left or deleting day 1, go to wishlist
            setActiveTab('wishlist');
        } else {
            // If deleting any other day, go to the previous day
            setActiveTab(`day${dayToDelete - 1}`);
        }
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

    // Get bias location from activities or selectedCity
    const getBiasLocation = () => {
        // First try to get coordinates from activities
        if (activities && activities.length > 0) {
            const validActivities = activities.filter(activity => activity.lat && activity.lng);
            if (validActivities.length > 0) {
                // Use the first activity with valid coordinates
                const firstActivity = validActivities[0];
                return `${firstActivity.lat},${firstActivity.lng}`;
            }
        }
        
        // Fallback to selectedCity if no activities have coordinates
        if (selectedCity) {
            return selectedCity;
        }
        
        return null;
    };

    // Handler for activity description card selection
    const handleActivityDescriptionCardSelect = (activity: Activity) => {
        setSelectedActivityForDetail(activity);
        setShowActivityDetail(true);
        // Set selected marker when opening detail view
        if (activity.place_id) {
            setSelectedMarker(activity.place_id);
        }
    };

    // Handler for closing activity detail view
    const handleCloseActivityDetail = () => {
        setShowActivityDetail(false);
        setSelectedActivityForDetail(null);
        // Clear selected marker when closing detail view
        setSelectedMarker(null);
        // Trigger scroll position restore for the current active tab only
        if (activeTab.startsWith('day')) {
            const currentDayNumber = parseInt(activeTab.replace('day', ''));
            setShouldRestoreScrollPositions(prev => ({
                ...prev,
                [currentDayNumber]: true
            }));
            // Reset the flag immediately after next render
            setTimeout(() => {
                setShouldRestoreScrollPositions(prev => ({
                    ...prev,
                    [currentDayNumber]: false
                }));
            }, 0);
        }
    };

    // Handler for place selection from GooglePlacesAutocomplete
    const handlePlaceSelect = async (data: any, details: any | null) => {
        try {
            setIsAddPlacesModalVisible(false);
            setIsAddingPlace(true);
            
            // Call the backend to add additional place
            const result = await API.graphql(graphqlOperation(`
                query AddAdditionalPlace($placeName: String!, $selectedCity: String!) {
                    addAdditionalPlace(placeName: $placeName, selectedCity: $selectedCity) {
                        name
                        city
                        lat
                        lng
                        place_id
                        rating
                        user_ratings_total
                        formatted_address
                        types
                        primaryType
                        photo_reference
                        is_recommended
                        display_name
                        website_uri
                        regular_opening_hours {
                            open_now
                            weekday_text
                        }
                        reviews {
                            author_name
                            rating
                            text
                            time
                            author_url
                            profile_photo_url
                        }
                        editorial_summary
                        primary_type_display_name
                        international_phone_number
                    }
                }
            `, { 
                placeName: data.description,
                selectedCity: selectedCity || 'Unknown City'
            })) as any;
            
            const newActivity = result?.data?.addAdditionalPlace;
            if (newActivity) {
                // Check for duplicates before adding
                const existingPlaceIds = new Set();
                
                // Collect place_ids from current activities (wishlist)
                (activities || []).forEach(activity => {
                    if (activity.place_id) {
                        existingPlaceIds.add(activity.place_id);
                    }
                });
                
                // Collect place_ids from all day activities
                Object.values(dayActivities).forEach(dayObj => {
                    if (Array.isArray((dayObj as any).activities)) {
                        (dayObj as any).activities.forEach((activity: Activity) => {
                            if (activity.place_id) {
                                existingPlaceIds.add(activity.place_id);
                            }
                        });
                    }
                });
                
                // Check if the new activity is a duplicate
                if (newActivity.place_id && existingPlaceIds.has(newActivity.place_id)) {
                    Alert.alert(
                        'Duplicate Place', 
                        `"${newActivity.name}" is already in your trip.`,
                        [{ text: 'OK' }]
                    );
                } else {
                    // Add the new activity to the active tab
                    if (activeTab === 'wishlist') {
                        // Add to wishlist (activities list)
                        updateActivities([...activities, newActivity]);
                    } else if (activeTab.startsWith('day')) {
                        // Add to the specific day
                        const dayNumber = parseInt(activeTab.replace('day', ''));
                        addActivityToDay(newActivity, dayNumber);
                    } else {
                        // Fallback to wishlist
                        updateActivities([...activities, newActivity]);
                    }
                }
            } else {
                console.warn('Could not get place details');
            }
        } catch (error) {
            console.error('Error adding place:', error);
            // Optionally show a user-facing error message
        } finally {
            setIsAddingPlace(false);
        }
    };

    // Reset shouldScrollToActive after it's been used
    React.useEffect(() => {
        if (shouldScrollToActive) {
            setShouldScrollToActive(false);
        }
    }, [shouldScrollToActive]);

    // Serialize trip data for saving
    const saveTrip = async () => {
        // Gather days and their activities
        const days = Object.keys(dayActivities).map(dayNumber => ({
            dayNumber: Number(dayNumber),
            activities: dayActivities[dayNumber].activities,
            encodedPolyline: dayPolylines[dayNumber] || null,
        }));
        // Gather wishlist activities (not assigned to any day)
        const dayActivityIds = days.flatMap(day => day.activities.map(a => a.place_id)).filter(Boolean);
        const wishlist = (activities || []).filter((activity) => !activity.place_id || !dayActivityIds.includes(activity.place_id));
        // Compose trip data object
        let tripCreatedAt = createdAt;
        if (!tripCreatedAt) {
            tripCreatedAt = new Date().toISOString();
            setCreatedAt(tripCreatedAt);
        }
        const tripData = {
            tripId,
            days,
            wishlist,
            createdAt: tripCreatedAt,
            tripLength: tripLength || days.length, // Include tripLength in saved data
        };
        // Commented out GraphQL save trip call
        // const result = await API.graphql(
        //     graphqlOperation(createTrip, { input: tripData })
        // );
        setTripId(tripData.tripId); // Update tripId in context after successful save
        await AsyncStorage.setItem('lastSavedTrip', JSON.stringify(tripData));
    };

    useEffect(() => {
        navigation.setOptions({
          headerShown: false
        });
    }, []);

    useEffect(() => {
        if (restoreTrip) {
            (async () => {
                // Example: load from AsyncStorage or other storage
                // For now, let's assume you have a function to get the saved trip
                // Replace this with your actual loading logic
                const saved = await (window as any).getLastSavedTrip?.(); // placeholder for your loading logic
                if (saved) {
                    restoreTripFromObject(saved);
                    // Log restored dayActivities
                    setTimeout(() => {
                    }, 500); // Delay to allow state update
                }
            })();
        }
    }, [restoreTrip, restoreTripFromObject]);

    // Log getDayActivities for each day
    useEffect(() => {
        if (dayActivities) {
            Object.keys(dayActivities).forEach(dayNumber => {
                const acts = getDayActivities(Number(dayNumber));
            });
        }
    }, [dayActivities]);

    return (
        <>
            <TripMapView 
                activities={getActivitiesForTab(activeTab)} 
                activeTab={activeTab}
                routeCoordinates={
                  activeTab.startsWith('day') && getActivitiesForTab(activeTab).length > 0
                    ? routeData.polyline
                    : []
                }
                routeLoading={routeLoading}
                selectedActivities={selectedActivities}
                onMarkerPress={handleActivityDescriptionCardSelect}
                selectedMarker={selectedMarker}
            />
            
            <View style={styles.container}>
                {!showActivityDetail && (
                    <TabBar 
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        dayCount={getDayCount()}
                        onAddDay={handleAddDay}
                        onDeleteDay={handleDeleteDay}
                        shouldScrollToActive={shouldScrollToActive}
                        tabLabels={tabLabels}
                    />
                )}

                {/* Tab Content */}
                <View style={styles.tabContent}>
                {showActivityDetail && selectedActivityForDetail ? (
                    <ActivityDetailView 
                        activity={selectedActivityForDetail}
                        onClose={handleCloseActivityDetail}
                    />
                ) : (
                    <>
                        {activeTab === 'wishlist' && (() => {
                            const wishlistActivities = getActivitiesForTab('wishlist');
                            const activitiesByCity = wishlistActivities.reduce((acc: { [key: string]: Activity[] }, activity) => {
                                const city = activity.city || 'Unknown City';
                                if (!acc[city]) acc[city] = [];
                                acc[city].push(activity);
                                return acc;
                            }, {} as { [key: string]: Activity[] });

                            return (
                                <ScrollView 
                                    style={styles.wishlistContainer}
                                    contentContainerStyle={styles.wishlistContent}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {wishlistActivities.length === 0 ? (
                                        <View>
                                            {selectedCity && (
                                                <Text style={styles.cityTitle}>{selectedCity}</Text>
                                            )}
                                            <View style={{ marginTop: 10, alignItems: 'center', padding: 20 }}>
                                                <AddPlacesButton
                                                    onPress={() => setIsAddPlacesModalVisible(true)}
                                                    isAddingPlace={isAddingPlace}
                                                    style={{ marginTop: 10, borderColor: Colors.GRAY }}
                                                    showLoadingIndicator={false}
                                                />
                                            </View>
                                        </View>
                                    ) : (
                                        <>
                                            {Object.entries(activitiesByCity).map(([city, cityActivities]: [string, Activity[]]) => (
                                                <View key={`wishlist-${city}`} style={styles.citySection}>
                                                    <Text style={styles.cityTitle}>{city}</Text>
                                                    <WishlistActivities 
                                                        activities={cityActivities}
                                                        selectedActivities={selectedActivities}
                                                        onActivitySelect={toggleActivitySelection}
                                                        onActivityDeselect={toggleActivitySelection}
                                                        onDescriptionCardPress={handleActivityDescriptionCardSelect}
                                                        showSelectionIndicator={isSelectionMode}
                                                    />
                                                </View>
                                            ))}
                                            
                                            {/* Add additional places button */}
                                            <AddPlacesButton
                                                onPress={() => setIsAddPlacesModalVisible(true)}
                                                isAddingPlace={isAddingPlace}
                                            />
                                        </>
                                    )}
                                </ScrollView>
                            );
                        })()}
                        
                        {activeTab.startsWith('day') && (() => {
                            const currentDayNumber = parseInt(activeTab.replace('day', ''));
                            return (
                                <DaySchedule 
                                    dayNumber={currentDayNumber}
                                    activities={getActivitiesForTab(activeTab)}
                                    selectedActivities={selectedActivities}
                                    onActivitySelect={toggleActivitySelection}
                                    onActivityDeselect={toggleActivitySelection}
                                    onDescriptionCardPress={handleActivityDescriptionCardSelect}
                                    onTransferToWishlist={handleTransferToWishlist}
                                    onOptimizeRoute={handleOptimizeRoute}
                                    showSelectionIndicator={isSelectionMode}
                                    routeLegs={routeData.legs}
                                    onAddPlace={() => setIsAddPlacesModalVisible(true)}
                                    isAddingPlace={isAddingPlace}
                                    scrollPosition={dayScrollPositions[currentDayNumber] || 0}
                                    onScrollPositionChange={(position) => handleScrollPositionChange(currentDayNumber, position)}
                                    shouldRestorePosition={shouldRestoreScrollPositions[currentDayNumber] || false}
                                    travelMode={routeData.travelMode}
                                />
                            );
                        })()}
                    </>
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
                const noActivityDetail = !showActivityDetail;
                
                if (isLastDay && hasActivities && noSelection && noActivityDetail) {
                    return (
                        <TouchableOpacity 
                            style={styles.publishButton}
                            onPress={() => {
                                saveTrip();
                                router.push({
                                    pathname: '/trip-view/publish_success',
                                    params: {
                                        dayCount: getDayCount().toString()
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

                {/* Add Places Modal */}
                <Modal
                visible={isAddPlacesModalVisible}
                animationType="slide"
                presentationStyle="formSheet"
                onRequestClose={() => setIsAddPlacesModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    style={styles.addPlacesModalContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.addPlacesModalHeader}>
                        <TouchableOpacity 
                            onPress={() => setIsAddPlacesModalVisible(false)}
                            style={styles.addPlacesModalCloseButton}
                        >
                            <Ionicons name="close" size={32} color={Colors.GRAY} />
                        </TouchableOpacity>
                        <Text style={styles.addPlacesModalTitle}>Add Additional Places</Text>
                        <View style={styles.addPlacesModalSpacer} />
                    </View>
                    
                    <View style={styles.addPlacesModalContent}>
                        <GooglePlacesAutocomplete
                            placeholder={`Search places in ${selectedCity}`}
                            onPress={handlePlaceSelect}
                            query={{
                                key: API_KEYS.GOOGLE_MAPS,
                                language: 'en',
                                ...(getBiasLocation() && {
                                    location: getBiasLocation(),
                                    radius: 10000, // 25km radius around the bias location
                                }),
                            }}
                            styles={{
                                container: styles.googlePlacesContainer,
                                textInputContainer: styles.googlePlacesTextInputContainer,
                                textInput: styles.googlePlacesInput,
                                listView: styles.googlePlacesList,
                                row: styles.googlePlacesRow,
                                description: styles.googlePlacesDescription,
                            }}
                            fetchDetails={false}
                            enablePoweredByContainer={false}
                            debounce={200}
                        />
                    </View>
                </KeyboardAvoidingView>
                </Modal>
            </View>
            
            <TouchableOpacity 
                style={styles.homeButton} 
                onPress={async () => {
                    const dayCountVal = getDayCount();
                    await saveTrip();
                    if (restoreTrip) {
                        let lastActivityPhotoRef = '';
                        if (dayCountVal > 0) {
                            const lastDayActivities = getDayActivities(dayCountVal);
                            if (lastDayActivities && lastDayActivities.length > 0) {
                                lastActivityPhotoRef = lastDayActivities[lastDayActivities.length - 1]?.photo_reference || '';
                            }
                        }
                        router.push({
                            pathname: '/profile',
                            params: {
                                photoReference: lastActivityPhotoRef,
                                dayCount: dayCountVal.toString(),
                            }
                        });
                    } else {
                        router.push({
                            pathname: '/trip-view/publish_success',
                            params: {
                                dayCount: dayCountVal.toString(),
                            }
                        });
                    }
                }}
            >
                <Entypo name="home" size={30} color={Colors.PRIMARY} />
            </TouchableOpacity>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.WHITE,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 10,
        marginTop: -30,
    },
    homeButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 1, // Ensure it's above the map
        backgroundColor: 'white',
        borderRadius: 25,
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
    citySection: {
        marginBottom: 5,
    },
    cityTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        marginTop: 0,
        textAlign: 'center',
        marginBottom: 13,
        color: '#1a1a1a',
    },
    wishlistContainer: {
        flex: 1,
    },
    wishlistContent: {
        paddingBottom: 20,
    },
    addPlacesModalContainer: {
        height: '50%', // Reduced to 50% of screen height
        backgroundColor: Colors.WHITE,
    },
    addPlacesModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    addPlacesModalCloseButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPlacesModalTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        color: '#1a1a1a',
    },
    addPlacesModalSpacer: {
        width: 40,
    },
    addPlacesModalContent: {
        flex: 1,
        padding: 20,
    },
    googlePlacesContainer: {
        flex: 0,
        zIndex: 1,
    },
    googlePlacesTextInputContainer: {
        flexDirection: 'row',
        width: '100%',
    },
    googlePlacesInput: {
        height: 50,
        color: '#1a1a1a',
        fontSize: 16,
        fontFamily: 'outfit',
        borderWidth: 1,
        borderRadius: 15,
        borderColor: '#1a1a1a',
        paddingHorizontal: 15,
        flex: 1,
    },
    googlePlacesList: {
        backgroundColor: 'white',
        borderRadius: 15,
        marginTop: 5,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    googlePlacesRow: {
        backgroundColor: 'white',
        padding: 13,
        height: 44,
        flexDirection: 'row',
    },
    googlePlacesDescription: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#1a1a1a',
    },
});
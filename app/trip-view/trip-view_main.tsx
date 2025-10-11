import { Colors } from '../../constants/Colors';
import { useNavigation, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert, AppState, Animated, PanResponder, Dimensions } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { encodePolyline } from '../../src/utils/polyline';
import { DaySchedule, TabBar, WishlistActivities } from '../../src/components/trip-view';
import { TripMapView } from '../../src/components/trip-view/map_view';
import { TransferActivitiesModal } from '../../src/components/trip-view/transfer_activities_modal';
import { TransferButtonContainer } from '../../src/components/trip-view/transfer_delete_button_containor';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';
import { ActivityDetailView } from '../../src/components/trip-view/description_card';
import { SearchBar } from '../../src/components/explore/SearchBar';
import { AutocompleteModal } from '../../src/components/explore/AutocompleteModal';
import { useActivitySelection } from '../../src/hooks/use_activity_selection';
import { useDayActivities } from '../../src/hooks/use_day_activities';
import { useTransferActivities } from '../../src/hooks/use_transfer_activities';
import { fetchRoutePolyline, RouteData } from '../../src/services/getRoute_graphQL_call';
import { optimizeRouteWithHaversine } from '../../src/components/trip-view/logic/optimize_route';
import { Activity, TabType } from '../../src/types/activity.types';
import { API, Auth, graphqlOperation } from 'aws-amplify';
import { createTrip } from '../../src/graphql/mutations';
import { retrieveTripFromCloud } from '../../src/services/lambdaService';
import Entypo from '@expo/vector-icons/Entypo';

// GraphQL subscription for real-time trip updates
const onTripUpdated = /* GraphQL */ `
    subscription OnTripUpdated($tripId: String!) {
        onTripUpdated(tripId: $tripId) {
            tripId
            version
            updatedAt
            lastUpdatedBy
            collaborators {
                email
                fullName
                userID
                role
                addedBy
            }
        }
    }
`;


export default function TripViewMain() {
    const router = useRouter();
    const navigation = useNavigation();
    const params = useLocalSearchParams();
    const { restoreTrip } = params;
    const { activities, removeActivities, setDayPolyline, tripId, wishlistText, dayPolylines, updateActivities, setTripId, restoreTripFromObject, createdAt, setCreatedAt, tripLength, setTripLength, setDayPolylinesDeleteDay, selectedCity, generateTripId, tripPhotoReference, collaborators, currentUserRole, setCollaborators, isOwner, searchActivities, version, setVersion, updatedAt, setUpdatedAt, lastUpdatedBy, setLastUpdatedBy } = useCreateTrip();
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

    // State for SearchBar and AutocompleteModal
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [isShareModalVisible, setIsShareModalVisible] = useState(false);
    const [currentUserID, setCurrentUserID] = useState<string>('');

    // State for activity detail view
    const [selectedActivityForDetail, setSelectedActivityForDetail] = useState<Activity | null>(null);
    const [showActivityDetail, setShowActivityDetail] = useState(false);
    
    // State for selected marker
    const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
    
    // State for scroll positions per day
    const [dayScrollPositions, setDayScrollPositions] = useState<{ [key: number]: number }>({});
    const [shouldRestoreScrollPositions, setShouldRestoreScrollPositions] = useState<{ [key: number]: boolean }>({});

    // State for draggable bottom section with 3 discrete states
    const screenHeight = Dimensions.get('window').height;
    const MIN_HEIGHT = 0.30; // 30% of screen height (minimum)
    const DEFAULT_HEIGHT = 0.65; // 65% of screen height (default)
    const MAX_HEIGHT = 0.90; // 90% of screen height (maximum)
    
    // Current height state (0 = min, 1 = default, 2 = max)
    const [currentHeightState, setCurrentHeightState] = useState(1); // Start at default
    const [bottomHeight] = useState(new Animated.Value(DEFAULT_HEIGHT));
    
    // Ref to track current state for pan responder (avoids stale closure)
    const currentHeightStateRef = useRef(1);
    
    // Array of height states for easy access
    const heightStates = [MIN_HEIGHT, DEFAULT_HEIGHT, MAX_HEIGHT];
    
    // Function to programmatically change height state
    const changeHeightState = (newState: number) => {
        if (newState >= 0 && newState < heightStates.length && newState !== currentHeightState) {
            setCurrentHeightState(newState);
            Animated.spring(bottomHeight, {
                toValue: heightStates[newState],
                useNativeDriver: false,
                tension: 80,
                friction: 8,
            }).start();
        }
    };

    // Save-in-progress lock to prevent concurrent saves and duplicate tripID generation
    const [isSaving, setIsSaving] = useState(false);

    // Ref for immediate tripID access (avoids async state update issues)
    const tripIdRef = useRef(tripId);

    // Timeout ref for debouncing autosave
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Version ref for immediate access (avoids async state issues)
    const versionRef = useRef<number>(version);

    // Real-time update notification state
    const [showUpdateNotification, setShowUpdateNotification] = useState(false);
    const [remoteUpdatedBy, setRemoteUpdatedBy] = useState<string | null>(null);

    // Track screen focus state for subscription management
    const [isScreenFocused, setIsScreenFocused] = useState(true);

    // Keep tripIdRef in sync with tripId state
    useEffect(() => {
        tripIdRef.current = tripId;
    }, [tripId]);

    // Reset height to default state on component mount/reload
    useEffect(() => {
        setCurrentHeightState(1); // Reset to default state
        currentHeightStateRef.current = 1; // Also reset the ref
        bottomHeight.setValue(DEFAULT_HEIGHT);
    }, []); // Empty dependency array means this runs only on mount

    // Keep ref in sync with state
    useEffect(() => {
        currentHeightStateRef.current = currentHeightState;
    }, [currentHeightState]);


    // Track screen focus to control subscription
    useFocusEffect(
        useCallback(() => {
            console.log('[trip-view_main] Screen focused - enabling subscription');
            setIsScreenFocused(true);

            return () => {
                console.log('[trip-view_main] Screen unfocused - disabling subscription');
                setIsScreenFocused(false);
            };
        }, [])
    );

    // Keep versionRef in sync with context version
    useEffect(() => {
        versionRef.current = version;
        console.log('[trip-view_main] Version ref synced:', version);
    }, [version]);

    // Handler for scroll position changes
    const handleScrollPositionChange = (dayNumber: number, position: number) => {
        setDayScrollPositions(prev => ({
            ...prev,
            [dayNumber]: position
        }));
    };

    // Pan responder for swipe gestures between discrete states
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only respond to significant vertical movement
                return Math.abs(gestureState.dy) > 10;
            },
            onPanResponderGrant: () => {
                // Stop any ongoing animation
                bottomHeight.stopAnimation();
            },
            onPanResponderMove: () => {
                // Don't update position during move - we'll snap on release
            },
            onPanResponderRelease: (_, gestureState) => {
                const swipeThreshold = 50; // Minimum distance for a swipe
                const swipeVelocityThreshold = 0.5; // Minimum velocity for a swipe
                
                const currentState = currentHeightStateRef.current; // Use ref for current value
                let newState = currentState;
                
                // Check for swipe up (negative dy) - go one step higher
                if (gestureState.dy < -swipeThreshold || gestureState.vy < -swipeVelocityThreshold) {
                    newState = Math.min(currentState + 1, 2); // Max state is 2
                }
                // Check for swipe down (positive dy) - go one step lower
                else if (gestureState.dy > swipeThreshold || gestureState.vy > swipeVelocityThreshold) {
                    newState = Math.max(currentState - 1, 0); // Min state is 0
                }
                
                // Animate to the new state if it changed
                if (newState !== currentState) {
                    setCurrentHeightState(newState);
                    Animated.spring(bottomHeight, {
                        toValue: heightStates[newState],
                        useNativeDriver: false,
                        tension: 80,
                        friction: 8,
                    }).start();
                }
            },
        })
    ).current;

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
        // Check if we have selected activities and are switching to a different tab
        if (isSelectionMode && selectedActivities.length > 0 && tab !== activeTab) {
            // Get the selected activities
            const selectedActivitiesList = getSelectedActivities(getActivitiesForTab(activeTab));

            if (selectedActivitiesList.length > 0) {
                // Transfer to the selected tab
                if (tab === 'wishlist') {
                    // Transfer to wishlist from the current day
                    let currentDayNumber = 1;
                    if (activeTab.startsWith('day')) {
                        currentDayNumber = parseInt(activeTab.replace('day', ''));
                    }
                    const activityIds = selectedActivitiesList
                        .map(a => a.place_id)
                        .filter((id): id is string => typeof id === 'string');

                    const transferredActivities = transferActivitiesToWishlist(activityIds, currentDayNumber);

                    // Add the transferred activities back to the wishlist
                    if (transferredActivities.length > 0) {
                        addActivitiesToWishlist(transferredActivities);
                    }
                } else if (tab.startsWith('day')) {
                    // Transfer to the selected day
                    const dayNumber = parseInt(tab.replace('day', ''));
                    transferActivitiesToDay(selectedActivitiesList, dayNumber);
                }

                // Clear selection after transfer
                clearSelection();
            }
        } else {
            // No selected activities, just clear selection
            clearSelection();
        }

        setActiveTab(tab);
        // Don't auto-scroll for manual tab selection
        setShouldScrollToActive(false);
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

    // Get activities for the current tab
    const getActivitiesForTab = (tab: TabType) => {
        if (tab === 'wishlist') {
            // Filter out activities that are already in days
            const dayActivityIds = Object.values(dayActivities || {})
                .flatMap(dayObj => Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : [])
                .map((activity: Activity) => activity.place_id)
                .filter(Boolean);

            return (activities || []).filter((activity: Activity) =>
                !activity.place_id || !dayActivityIds.includes(activity.place_id)
            );
        } else {
            // Extract day number from tab (e.g., 'day2' -> 2)
            const dayNumber = parseInt(tab.replace('day', ''));
            return getDayActivities(dayNumber) || [];
        }
    };

    // Function to add activities back to the wishlist
    const addActivitiesToWishlist = (newActivities: Activity[]) => {
        // Combine existing activities with new ones, removing duplicates by place_id
        const combinedActivities = [...(activities || []), ...newActivities];
        const deduplicatedActivities = combinedActivities.filter((activity, index, arr) => {
            if (!activity.place_id) return true; // Keep activities without place_id
            // Keep only the first occurrence of each place_id
            return arr.findIndex(a => a.place_id === activity.place_id) === index;
        });

        updateActivities(deduplicatedActivities);
    };

    // Remove local state and handlers for transfer modal and related logic
    // Use the custom hook for all transfer modal and activity transfer logic
    const {
        isModalVisible,
        setIsModalVisible,
        selectedDay,
        daysArray,
        handleOpenTransferModal,
        handleTransferToWishlist,
        handleDaySelection,
    } = useTransferActivities({
        activities: getActivitiesForTab(activeTab), // Pass current tab's activities instead of just wishlist
        activeTab,
        getSelectedActivities,
        transferActivitiesToDay,
        transferActivitiesToWishlist,
        clearSelection,
        getDayCount,
        onTabChange: handleTabChange, // Pass the tab change handler
        updateWishlistActivities: addActivitiesToWishlist, // Pass function to add activities back to wishlist
    });

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
        // Update tripLength to reflect the new day count
        setTripLength(getDayCount());
        // Switch to the newly created day
        setActiveTab(`day${newDayNumber}`);
        // Trigger auto-scroll to the new day
        setShouldScrollToActive(true);
    };

    const handleDeleteDay = () => {
        // Only allow deletion if activeTab is a day (not wishlist)
        if (!activeTab.startsWith('day')) return;

        const dayToDelete = parseInt(activeTab.replace('day', ''));

        // Check if the day has any activities
        const dayActivitiesForDelete = getDayActivities(dayToDelete);
        const hasActivities = dayActivitiesForDelete && dayActivitiesForDelete.length > 0;

        // Function to perform the deletion
        const performDeletion = () => {
            // Delete the day and get its activities to move back to wishlist
            const deletedDayActivities = deleteDayAndRenumber(dayToDelete);

            // Add deleted day activities back to wishlist (with deduplication)
            if (deletedDayActivities.length > 0) {
                const combinedActivities = [...(activities || []), ...deletedDayActivities];

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
            // Update tripLength to reflect the new day count
            setTripLength(remainingDayCount);
            if (remainingDayCount === 0 || dayToDelete === 1) {
                // If no days left or deleting day 1, go to wishlist
                setActiveTab('wishlist');
            } else {
                // If deleting any other day, go to the previous day
                setActiveTab(`day${dayToDelete - 1}`);
            }
        };

        // Only show confirmation dialog if the day has activities
        if (hasActivities) {
            Alert.alert(
                'Delete Day',
                `Are you sure you want to delete Day ${dayToDelete}?`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel'
                    },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: performDeletion
                    }
                ]
            );
        } else {
            // No activities, delete immediately without confirmation
            performDeletion();
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

    // Handle reordering activities within a day via drag and drop
    const handleDayActivityReorder = async (dayNumber: number, newOrder: Activity[]) => {
        try {
            // Update the activities for this day using the existing reorderDayActivities function
            reorderDayActivities(dayNumber, newOrder);

            // Clear the route cache for this day to trigger route recalculation
            const dayTab = `day${dayNumber}`;
            delete routeCache.current[dayTab];

            // If this is the currently active tab, trigger route recalculation
            if (activeTab === dayTab) {
                setRouteLoading(true);
                const newRouteData = await fetchRoutePolyline(newOrder);
                setRouteData(newRouteData);

                // Update the route cache for this day
                const activitiesHash = hashActivities(newOrder);
                routeCache.current[dayTab] = {
                    activitiesHash,
                    routeData: newRouteData,
                };

                // Store encoded polyline in context
                if (newRouteData.polyline && newRouteData.polyline.length > 1) {
                    const encoded = encodePolyline(newRouteData.polyline);
                    setDayPolyline(dayNumber, encoded);
                }

                setRouteLoading(false);
            }
        } catch (error) {
            console.error('Error reordering activities:', error);
            setRouteLoading(false);
        }
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

    // Handler for SearchBar press
    const handleSearchPress = () => {
        setShowAutocomplete(true);
    };

    // Handler for search query change
    const handleSearchQueryChange = (text: string) => {
        setSearchQuery(text);
    };

    // Handler for filter toggle
    const handleFilterToggle = (filterId: string) => {
        setSelectedFilters((prev) => {
            if (prev.includes(filterId)) {
                return prev.filter((id) => id !== filterId);
            } else {
                return [...prev, filterId];
            }
        });
    };

    // Handler for searching activities
    const handleSearchActivities = async (query: string, filters: string[], existingActivities: any[]) => {
        try {
            const results = await searchActivities(query, filters, existingActivities);
            return results;
        } catch (error) {
            console.error('[trip-view_main] Error fetching search results:', error);
            throw error;
        }
    };

    // Handler for saving search results
    const handleSaveSearchResults = (selectedActivities: Activity[]) => {
        if (selectedActivities.length === 0) {
            return;
        }

        // Add the selected activities to the active tab
        if (activeTab === 'wishlist') {
            // Add to wishlist
            updateActivities([...(activities || []), ...selectedActivities]);
        } else if (activeTab.startsWith('day')) {
            // Add to the specific day
            const dayNumber = parseInt(activeTab.replace('day', ''));
            selectedActivities.forEach(activity => {
                addActivityToDay(activity, dayNumber);
            });
        } else {
            // Fallback to wishlist
            updateActivities([...(activities || []), ...selectedActivities]);
        }

        // Close the autocomplete modal and reset search
        setShowAutocomplete(false);
        setSearchQuery('');
    };

    // Handler to reload trip with latest changes from remote
    const handleReloadTrip = async () => {
        try {
            console.log(`[trip-view_main] 🔄 Reloading trip - Current local version: ${version}`);

            // Get owner's userID from collaborators
            const owner = collaborators.find(c => c.role === 'owner');
            if (!owner) {
                Alert.alert('Error', 'Unable to reload trip: Owner information missing');
                return;
            }

            // Fetch latest trip data
            const updatedTrip = await retrieveTripFromCloud(owner.userID, tripId);

            if (updatedTrip) {
                const cloudVersion = updatedTrip.version || 1;
                console.log(`[trip-view_main] 📥 Retrieved from cloud - Version: ${cloudVersion}, Last updated by: ${updatedTrip.lastUpdatedBy}`);
                console.log(`[trip-view_main] Version sync: ${versionRef.current} → ${cloudVersion}`);

                // Restore trip data into context (includes version via restoreTripFromObject)
                restoreTripFromObject(updatedTrip, currentUserID);

                // Immediately sync versionRef to avoid race condition
                versionRef.current = cloudVersion;

                setShowUpdateNotification(false);
                console.log(`[trip-view_main] ✅ Trip reloaded - Version: ${cloudVersion}, Ref synced: ${versionRef.current}`);
            }
        } catch (error) {
            console.error('[trip-view_main] ❌ Error reloading trip:', error);
            Alert.alert('Error', 'Failed to reload trip. Please try again.');
        }
    };


    // Reset shouldScrollToActive after it's been used
    React.useEffect(() => {
        if (shouldScrollToActive) {
            setShouldScrollToActive(false);
        }
    }, [shouldScrollToActive]);

    // Helper function to sanitize activity objects for GraphQL input
    const sanitizeActivity = (activity: Activity & { __typename?: string }) => {
        const {
            __typename,
            regular_opening_hours,
            reviews,
            ...sanitized
        } = activity;

        // Clean regular_opening_hours if it exists
        let cleanOpeningHours = null;
        if (regular_opening_hours) {
            const { __typename: openingTypename, periods, ...openingHoursRest } = regular_opening_hours as any;
            cleanOpeningHours = {
                ...openingHoursRest,
                ...(periods && {
                    periods: periods.map((period: any) => {
                        const { __typename: periodTypename, open, close, ...periodRest } = period;
                        const cleanPeriod: any = { ...periodRest };

                        if (open) {
                            const { __typename: openTypename, ...openRest } = open;
                            cleanPeriod.open = openRest;
                        }

                        if (close) {
                            const { __typename: closeTypename, ...closeRest } = close;
                            cleanPeriod.close = closeRest;
                        }

                        return cleanPeriod;
                    })
                })
            };
        }

        // Clean reviews if they exist
        let cleanReviews = null;
        if (reviews && Array.isArray(reviews)) {
            cleanReviews = reviews.map((review: any) => {
                const { __typename: reviewTypename, ...reviewRest } = review;
                return reviewRest;
            });
        }

        return {
            ...sanitized,
            ...(cleanOpeningHours && { regular_opening_hours: cleanOpeningHours }),
            ...(cleanReviews && { reviews: cleanReviews })
        };
    };

    // Serialize trip data for saving
    const saveTrip = async () => {
        // Check if save is already in progress
        if (isSaving) {
            console.log('[trip-view_main] Save already in progress, skipping duplicate save');
            return;
        }

        setIsSaving(true);

        try {
            // Gather days and their activities (sanitize activities for GraphQL input)
            const days = Object.keys(dayActivities).map(dayNumber => ({
                dayNumber: Number(dayNumber),
                activities: dayActivities[dayNumber].activities.map(sanitizeActivity),
                encodedPolyline: dayPolylines[dayNumber] || null,
            }));
            // Gather wishlist activities (not assigned to any day) and sanitize them
            const dayActivityIds = days.flatMap(day => day.activities.map(a => a.place_id)).filter(Boolean);
            const wishlist = (activities || [])
                .filter((activity) => !activity.place_id || !dayActivityIds.includes(activity.place_id))
                .map(sanitizeActivity);
            // Compose trip data object
            // Generate tripId if it doesn't exist (first time save)
            // Use tripIdRef for immediate access to avoid race conditions
            let currentTripId = tripIdRef.current;
            if (!currentTripId) {
                currentTripId = generateTripId();
                console.log('[trip-view_main] Generated new tripId:', currentTripId);
                // Immediately update ref to prevent duplicate generation
                tripIdRef.current = currentTripId;
            }

            // Preserve original createdAt for existing trips, generate only for new trips
            let tripCreatedAt = createdAt;
            if (!tripCreatedAt) {
                tripCreatedAt = new Date().toISOString();
                setCreatedAt(tripCreatedAt);
                console.log('[trip-view_main] Generated new createdAt:', tripCreatedAt);
            } else {
                console.log('[trip-view_main] Using existing createdAt:', tripCreatedAt);
            }

            const tripData = {
                tripId: currentTripId,
                days,
                wishlist,
                tripLength: days.length, // Use tripLength state variable, fallback to days.length
                selectedCity,
                tripPhotoReference: tripPhotoReference || '',
                createdAt: tripCreatedAt,
            };

            console.log('[trip-view_main] Saving trip with data:', tripData);

            // Get current user information
            let currentUserID;
            let currentUserEmail;
            let currentUserName;
            const currentUser = await Auth.currentAuthenticatedUser();
            currentUserID = currentUser.attributes?.sub || currentUser.username;
            currentUserEmail = currentUser.attributes?.email || '';
            currentUserName = currentUser.attributes?.name || '';
            console.log('[trip-view_main] Current user ID:', currentUserID);

            // Handle collaborators and determine the owner's userID
            let collaboratorsToSave;
            let ownerUserID; // This will be used as the partition key in DynamoDB

            // Check if this is a truly NEW trip (no tripId AND no collaborators in context)
            const isBrandNewTrip = !tripId && collaborators.length === 0;

            if (isBrandNewTrip) {
                // NEW TRIP: Current user becomes owner
                console.log('[trip-view_main] Brand new trip - initializing owner as sole collaborator');
                ownerUserID = currentUserID;
                collaboratorsToSave = [{
                    email: currentUserEmail,
                    fullName: currentUserName,
                    userID: currentUserID,
                    role: 'owner',
                    addedBy: currentUserName
                }];
            } else {
                // EXISTING TRIP: Preserve ALL collaborators
                console.log('[trip-view_main] Existing trip - preserving all collaborators:', collaborators.length);

                // Find the owner's userID
                const owner = collaborators.find(c => c.role === 'owner');
                if (!owner) {
                    console.error('[trip-view_main] No owner found in collaborators');
                    Alert.alert('Error', 'Trip owner information is missing. Cannot save trip.');
                    return;
                }
                ownerUserID = owner.userID; // Always use owner's userID as partition key

                // Use existing collaborators (sanitized) - PRESERVE ALL
                collaboratorsToSave = collaborators.map(collaborator => ({
                    email: collaborator.email,
                    fullName: collaborator.fullName,
                    userID: collaborator.userID,
                    role: collaborator.role,
                    addedBy: collaborator.addedBy
                }));
            }

            // Add OWNER's userID, collaborators, and version tracking to trip data
            // This ensures we always use the owner's userID as the partition key in DynamoDB
            // Use versionRef.current for immediate access (not stale currentVersion state)
            const nextVersion = versionRef.current + 1;
            const tripDataWithUser = {
                ...tripData,
                userID: ownerUserID, // Always use owner's userID, not current user's userID
                collaborators: collaboratorsToSave,
                version: nextVersion, // Increment version for optimistic locking
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: currentUserEmail // Track who made the update
            };

            console.log(`[trip-view_main] 💾 Saving trip - Version: ${versionRef.current} → ${nextVersion}`);
            console.log('[trip-view_main] Updated by:', tripDataWithUser.lastUpdatedBy);

            // Make the API call (now using public auth)
            const result: any = await API.graphql({
                query: createTrip,
                variables: { input: tripDataWithUser }
            });
            console.log('[trip-view_main] Trip saved successfully:', result);

            // Update context version after successful save and immediately sync ref
            if (result.data?.createTrip?.version) {
                const savedVersion = result.data.createTrip.version;
                setVersion(savedVersion);
                setUpdatedAt(result.data.createTrip.updatedAt);
                setLastUpdatedBy(result.data.createTrip.lastUpdatedBy);
                versionRef.current = savedVersion; // Immediate sync to prevent race condition
                console.log(`[trip-view_main] ✅ Save confirmed - Version: ${savedVersion}, Ref: ${versionRef.current}, Updated by: ${result.data.createTrip.lastUpdatedBy}`);
            }

            // ALWAYS update tripId if it wasn't set (prevents duplicate generation on next save)
            if (!tripId) {
                setTripId(currentTripId);
            }

            // ALWAYS update createdAt if it wasn't set (prevents re-generating on next save)
            if (!createdAt) {
                setCreatedAt(tripCreatedAt);
            }

            // Update local collaborators state after successful save
            // For new trips OR if collaborators were somehow lost
            if (isBrandNewTrip || collaborators.length === 0) {
                console.log('[trip-view_main] Updating local collaborators state');
                setCollaborators(collaboratorsToSave);
            } else {
                console.log('[trip-view_main] Collaborators already set, skipping update');
            }

        } catch (error: any) {
            console.error('[trip-view_main] Error saving trip - Full error:', JSON.stringify(error, null, 2));

            // Check for version conflict error
            if (error.errors && error.errors.some((err: any) =>
                err.message && err.message.includes('Version conflict'))) {
                // Version conflict detected - another user updated the trip
                console.error(`[trip-view_main] ⚠️ VERSION CONFLICT - Attempted to save version ${versionRef.current + 1}, but trip was already updated by another user`);
                console.error(`[trip-view_main] Local version ref: ${versionRef.current}, Local version context: ${version}, Attempted save version: ${versionRef.current + 1}`);

                Alert.alert(
                    'Trip Updated',
                    `This trip was updated by another user while you were editing. Please reload to see the latest changes.`,
                    [
                        {
                            text: 'Reload Now',
                            onPress: handleReloadTrip
                        },
                        {
                            text: 'Cancel',
                            style: 'cancel'
                        }
                    ]
                );
                return; // Don't throw, handled gracefully
            }

            // More detailed error logging
            if (error.errors) {
                error.errors.forEach((err: any, index: number) => {
                    console.error(`[trip-view_main] ❌ Error ${index + 1}/${error.errors.length}:`, {
                        message: err.message,
                        errorType: err.errorType,
                        path: err.path,
                        data: err.data
                    });
                });
            }

            throw error;
        } finally {
            // Release save lock
            setIsSaving(false);
        }
    };

    useEffect(() => {
        navigation.setOptions({
          headerShown: false
        });
    }, []);

    // AppState listener for autosave when app goes to background
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'background') {
                console.log('[trip-view_main] App going to background - checking autosave eligibility');

                // Only autosave for owners and editors, NOT viewers
                if (currentUserRole === 'viewer') {
                    console.log('[trip-view_main] User is viewer, skipping autosave');
                    return;
                }

                console.log('[trip-view_main] User has edit permissions, scheduling autosave');

                // Clear any pending autosave
                if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                }

                // Debounce autosave by 500ms to prevent rapid duplicate saves
                saveTimeoutRef.current = setTimeout(() => {
                    // Only autosave if we have a trip with activities or days
                    if (tripIdRef.current || activities.length > 0 || Object.keys(dayActivities).length > 0) {
                        console.log('[trip-view_main] Executing debounced autosave');
                        saveTrip().catch(error => {
                            console.error('[trip-view_main] Autosave failed on app background:', error);
                        });
                    }
                }, 500);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            // Clean up timeout on unmount
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            subscription?.remove();
        };
    }, [tripId, activities, dayActivities, dayPolylines, tripLength, selectedCity, tripPhotoReference, createdAt, currentUserRole]);

    // Real-time subscription for trip updates
    useEffect(() => {
        // Only subscribe if we have a tripId AND screen is focused
        if (!tripId) {
            console.log('[trip-view_main] Skipping subscription - no tripId');
            return;
        }

        if (!isScreenFocused) {
            console.log('[trip-view_main] Skipping subscription - screen not focused');
            return;
        }

        console.log('[trip-view_main] Subscribing to real-time updates for trip:', tripId);

        const subscription = (API.graphql(
            graphqlOperation(onTripUpdated, { tripId })
        ) as any).subscribe({
            next: ({ value }: any) => {
                console.log('[trip-view_main] Real-time update received', JSON.stringify(value, null, 2));

                const updatedTrip = value?.data?.onTripUpdated;

                // Null check - subscription may fire without data
                if (!updatedTrip) {
                    console.log('[trip-view_main] Received subscription event with no data, ignoring');
                    return;
                }

                console.log(`[trip-view_main] 🔔 Remote update received - Version: ${updatedTrip.version}, Updated by: ${updatedTrip.lastUpdatedBy}`);
                console.log(`[trip-view_main] Local version before update - Context: ${version}, Ref: ${versionRef.current}`);

                // Don't process our own updates (avoid infinite loop)
                // Check if update is from current user OR if version hasn't actually changed
                if (updatedTrip.lastUpdatedBy === currentUserID || updatedTrip.version === versionRef.current) {
                    console.log(`[trip-view_main] Ignoring update - Same user: ${updatedTrip.lastUpdatedBy === currentUserID}, Same version: ${updatedTrip.version === versionRef.current}`);
                    return;
                }

                // Update detected from another collaborator
                console.log(`[trip-view_main] ✅ Version updated: ${versionRef.current} → ${updatedTrip.version}`);

                // Update context version and immediately sync ref to avoid race condition
                setVersion(updatedTrip.version);
                setUpdatedAt(updatedTrip.updatedAt);
                setLastUpdatedBy(updatedTrip.lastUpdatedBy);
                versionRef.current = updatedTrip.version; // Immediate sync

                setRemoteUpdatedBy(updatedTrip.lastUpdatedBy);
                setShowUpdateNotification(true);

                console.log(`[trip-view_main] Showing update notification from: ${updatedTrip.lastUpdatedBy}`);
            },
            error: (error: any) => {
                console.error('[trip-view_main] Subscription error:', error);
            }
        });

        return () => {
            console.log('[trip-view_main] Unsubscribing from trip updates');
            subscription.unsubscribe();
        };
    }, [tripId, currentUserID, currentUserRole, isScreenFocused]);

    // Get current user ID for collaboration features
    useEffect(() => {
        const getCurrentUser = async () => {
            try {
                const user = await Auth.currentAuthenticatedUser();
                const userID = user.attributes?.sub || user.username;
                setCurrentUserID(userID);
            } catch (error) {
                console.error('[trip-view_main] Error getting current user:', error);
            }
        };

        getCurrentUser();
    }, []);


    // Handle collaboration modal
    const handleShareTrip = async () => {

        // For new trips (no tripId yet), initialize collaborators with current user as owner
        if (!tripId && collaborators.length === 0) {
            try {
                const currentUser = await Auth.currentAuthenticatedUser();
                const currentUserID = currentUser.attributes?.sub || currentUser.username;
                const currentUserEmail = currentUser.attributes?.email || '';
                const currentUserName = currentUser.attributes?.name || '';

                const ownerCollaborator = {
                    email: currentUserEmail,
                    fullName: currentUserName,
                    userID: currentUserID,
                    role: 'owner',
                    addedBy: currentUserName
                };

                setCollaborators([ownerCollaborator]);
            } catch (error) {
                console.error('[trip-view_main] Error getting current user for collaborators:', error);
                Alert.alert('Error', 'Unable to load user information for sharing');
                return;
            }
        }

        setIsShareModalVisible(true);
    };

    const handleCollaboratorsUpdate = (updatedCollaborators: any[]) => {
        setCollaborators(updatedCollaborators);
    };


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
                onShareTrip={async () => {
                    if (!tripId) {
                        // Save trip first if it doesn't exist
                        await saveTrip();
                    }
                    handleShareTrip();
                }}
            />

            {/* Real-time update notification banner */}
            {showUpdateNotification && remoteUpdatedBy && (
                <View style={styles.updateBanner}>
                    <View style={styles.updateContent}>
                        <Text style={styles.updateText}>
                            {remoteUpdatedBy} updated this trip
                        </Text>
                        <View style={styles.updateActions}>
                            <TouchableOpacity
                                style={styles.reloadButton}
                                onPress={handleReloadTrip}
                            >
                                <Text style={styles.reloadButtonText}>Reload</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.dismissButton}
                                onPress={() => setShowUpdateNotification(false)}
                            >
                                <Text style={styles.dismissText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            <Animated.View style={[
                styles.container,
                {
                    height: bottomHeight.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                    }),
                }
            ]}>
                {/* Draggable indicator bar */}
                <View {...panResponder.panHandlers} style={styles.dragIndicatorContainer}>
                    <View style={styles.dragIndicator} />
                </View>

                {!showActivityDetail && (
                    <TabBar 
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        dayCount={getDayCount()}
                        onAddDay={handleAddDay}
                        onDeleteDay={handleDeleteDay}
                        shouldScrollToActive={shouldScrollToActive}
                        tabLabels={tabLabels}
                        currentUserRole={currentUserRole}
                    />
                )}

                {/* Tab Content */}
                <View style={styles.tabContent}>
                {showActivityDetail && selectedActivityForDetail ? (
                    <ActivityDetailView
                        activity={selectedActivityForDetail}
                        onClose={handleCloseActivityDetail}
                        showDragIndicator={false}
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
                                            {/* SearchBar when no wishlist activities - hide for viewers */}
                                            {currentUserRole !== 'viewer' && (
                                                <View style={{ marginTop: 0, marginBottom: 0 }}>
                                                <SearchBar
                                                        value={searchQuery}
                                                        onChangeText={handleSearchQueryChange}
                                                        onPress={handleSearchPress}
                                                        placeholder="Add more activities"
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    ) : (
                                        <>
                                            {Object.entries(activitiesByCity).map(([city, cityActivities]: [string, Activity[]]) => (
                                                <View key={`wishlist-${city}`} style={styles.citySection}>
                                                    <Text style={styles.cityTitle}>{city}</Text>
                                                    <WishlistActivities
                                                        activities={cityActivities}
                                                        selectedActivities={selectedActivities}
                                                        onActivitySelect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                                        onActivityDeselect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                                        onDescriptionCardPress={handleActivityDescriptionCardSelect}
                                                        showSelectionIndicator={isSelectionMode && currentUserRole !== 'viewer'}
                                                    />
                                                </View>
                                            ))}

                                            {/* SearchBar after all activities - hide for viewers */}
                                            {currentUserRole !== 'viewer' && (
                                                <View style={{ marginTop: -30 }}>
                                                    <SearchBar
                                                        value={searchQuery}
                                                        onChangeText={handleSearchQueryChange}
                                                        onPress={handleSearchPress}
                                                        placeholder="Add more activities"
                                                    />
                                                </View>
                                            )}
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
                                    onActivitySelect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                    onActivityDeselect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                    onDescriptionCardPress={handleActivityDescriptionCardSelect}
                                    onTransferToWishlist={handleTransferToWishlist}
                                    onOptimizeRoute={currentUserRole !== 'viewer' ? handleOptimizeRoute : undefined}
                                    showSelectionIndicator={isSelectionMode && currentUserRole !== 'viewer'}
                                    routeLegs={routeData.legs}
                                    onAddPlace={currentUserRole !== 'viewer' ? handleSearchPress : undefined}
                                    searchQuery={searchQuery}
                                    onSearchQueryChange={handleSearchQueryChange}
                                    scrollPosition={dayScrollPositions[currentDayNumber] || 0}
                                    onScrollPositionChange={(position) => handleScrollPositionChange(currentDayNumber, position)}
                                    shouldRestorePosition={shouldRestoreScrollPositions[currentDayNumber] || false}
                                    travelMode={routeData.travelMode}
                                    onReorder={currentUserRole !== 'viewer' ? handleDayActivityReorder : undefined}
                                    routeLoading={routeLoading}
                                    onGoToWishlist={() => handleTabChange('wishlist')}
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
                currentUserRole={currentUserRole}
                />

                {/* Transfer Modal */}
                <TransferActivitiesModal
                visible={isModalVisible}
                daysArray={daysArray}
                selectedDay={selectedDay}
                onSelectDay={handleDaySelection}
                onClose={() => setIsModalVisible(false)}
                />
            </Animated.View>

            {/* AutocompleteModal for searching activities */}
            <AutocompleteModal
                visible={showAutocomplete}
                query={searchQuery}
                filters={selectedFilters}
                selectedCity={selectedCity || ''}
                onClose={() => {
                    setShowAutocomplete(false);
                    setSearchQuery('');
                }}
                onFilterToggle={handleFilterToggle}
                onQueryChange={handleSearchQueryChange}
                onSearchActivities={handleSearchActivities}
                onSaveActivities={handleSaveSearchResults}
                wishlistActivities={[
                    ...(activities || []),
                    ...Object.values(dayActivities || {}).flatMap(dayObj =>
                        Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : []
                    )
                ]}
                activeTab={activeTab}
            />

            {/* Share Trip Modal */}
            {currentUserID && (
                <ShareTripModal
                    visible={isShareModalVisible && !!tripId}
                    onClose={() => setIsShareModalVisible(false)}
                    tripId={tripId || ''}
                    collaborators={collaborators || []}
                    currentUserRole={currentUserRole || 'owner'}
                    currentUserID={currentUserID}
                    selectedCity={selectedCity}
                    onCollaboratorsUpdate={handleCollaboratorsUpdate}
                />
            )}

            <TouchableOpacity
                style={styles.homeButton}
                onPress={async () => {
                    const dayCountVal = getDayCount();

                    // Only save if user has edit permissions (owner or editor)
                    if (currentUserRole !== 'viewer') {
                        await saveTrip();
                    } else {
                        console.log('[trip-view_main] Viewer navigating home - skipping save');
                    }

                    // Check if this is an existing trip (loaded from cloud) or a new trip
                    const isExistingTrip = tripId;

                    if (isExistingTrip) {
                        // This trip was loaded from cloud storage, go back to profile
                        let lastActivityPhotoRef = '';
                        const day1Activities = getDayActivities(1);
                        if (day1Activities && day1Activities.length > 0) {
                            lastActivityPhotoRef = day1Activities[0]?.photo_reference || '';
                        } else if (activities && Array.isArray(activities) && activities.length > 0) {
                            lastActivityPhotoRef = activities[0]?.photo_reference || '';
                        }
                        router.push({
                            pathname: '/profile',
                            params: {
                                photoReference: lastActivityPhotoRef,
                                dayCount: dayCountVal.toString(),
                            }
                        });
                    } else {
                        // This is a new trip, show publish success page
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
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.WHITE,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 0,
    },
    dragIndicatorContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 12,
        paddingTop: 8,
    },
    dragIndicator: {
        width: 40,
        height: 5,
        backgroundColor: '#D1D5DB',
        borderRadius: 3,
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
    shareButton: {
        position: 'absolute',
        top: 60,
        left: 80, // Position next to home button
        zIndex: 1,
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
    updateBanner: {
        position: 'absolute',
        top: 120,
        left: 20,
        right: 20,
        backgroundColor: Colors.PRIMARY,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        zIndex: 999,
    },
    updateContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    updateText: {
        color: 'white',
        fontFamily: 'outfit',
        fontSize: 15,
        flex: 1,
        marginRight: 12,
    },
    updateActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reloadButton: {
        backgroundColor: 'white',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 6,
    },
    reloadButtonText: {
        color: Colors.PRIMARY,
        fontFamily: 'outfit-bold',
        fontSize: 14,
    },
    dismissButton: {
        padding: 4,
    },
    dismissText: {
        color: 'white',
        fontSize: 20,
        fontFamily: 'outfit-bold',
    },
});
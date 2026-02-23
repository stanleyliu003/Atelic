import { Colors } from '../../constants/Colors';
import { useNavigation, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert, AppState, Animated, PanResponder, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { encodePolyline } from '../../src/utils/polyline';
import { getMarkerColor } from '../../src/constants/mapColors';
import { DaySchedule, TabBar, WishlistActivities } from '../../src/components/trip-view';
import { TripMapView } from '../../src/components/trip-view/map_view';
import { ActivityCard } from '../../src/components/trip-view/activity/activity_card';
import { TransferActivitiesModal } from '../../src/components/trip-view/transfer_activities_modal';
import { TransferButtonContainer } from '../../src/components/trip-view/transfer_delete_button_containor';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';
import { ActivityDetailView } from '../../src/components/trip-view/description_card';
import OverviewContent from '../../src/components/trip-view/OverviewContent';
import SimpleDatePicker from '../../src/components/trip-view/SimpleDatePicker';
import { SearchBar } from '../../src/components/explore/SearchBar';
import { AutocompleteModal } from '../../src/components/explore/AutocompleteModal';
import { CategoryModal } from '../../src/components/explore/CategoryModal';
import { useActivitySelection } from '../../src/hooks/use_activity_selection';
import { useDayActivities } from '../../src/hooks/use_day_activities';
import { useTransferActivities } from '../../src/hooks/use_transfer_activities';
import { fetchRoutePolyline, fetchRoutePolylineWithMode, RouteData as BasicRouteData } from '../../src/services/getRoute_graphQL_call';
import { optimizeRouteWithHaversine } from '../../src/components/trip-view/logic/optimize_route';
import { Activity, TabType, TravelMode, EnhancedRouteLeg, RouteLegModeData, RouteData } from '../../src/types/activity.types';
import type { FlightReservation } from '../../src/types/flight.types';
import TransportationSettingsModal from '../../src/components/trip-view/transportation_settings_modal';
import { decodePolyline } from '../../src/utils/polyline';
import { API, Auth, graphqlOperation } from 'aws-amplify';
import { createTrip } from '../../src/graphql/mutations';
import { onCreateTripOperation } from '../../src/graphql/subscriptions';
import { retrieveTripFromCloud } from '../../src/services/lambdaService';
import Entypo from '@expo/vector-icons/Entypo';
import { duplicateActivity, ensureActivitiesHaveInstanceIds } from '../../src/utils/activityInstanceId';
import { Operation } from '../../src/types/operation.types';
import { saveOperation, listOperations } from '../../src/services/tripOperationsService';
import { verifyStateReconstruction, applyOperation, ReconstructedTripState, TransportModeOverrides } from '../../src/services/tripReconstructionService';
import { getSavedPlacesDetailed } from '../../src/graphql/customQueries';
import { filterSavedPlacesByCity } from '../../src/utils/cityMatching';
import { findRelatedLodgingInstancesWithDays } from '../../src/utils/lodging_enforcement';

// GraphQL subscription for real-time trip updates
const onTripUpdated = /* GraphQL */ `
    subscription OnTripUpdated($tripId: String!) {
        onTripUpdated(tripId: $tripId) {
            tripId
            version
            updatedAt
            lastUpdatedBy
            startDate
            endDate
            tripLength
            collaborators {
                email
                fullName
                username
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
    const { restoreTrip, fromSavedPlaces } = params;
    const {
        activities,
        removeActivities,
        setDayPolyline,
        tripId,
        wishlistText,
        dayPolylines,
        dayTravelModes,
        setLegTravelMode,
        updateActivities,
        setTripId,
        restoreTripFromObject,
        setDayActivities,
        createdAt,
        setCreatedAt,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        tripLength,
        setTripLength,
        setDayPolylinesDeleteDay,
        selectedCity,
        generateTripId,
        tripPhotoReference,
        collaborators,
        currentUserRole,
        setCollaborators,
        isOwner,
        version,
        setVersion,
        updatedAt,
        setUpdatedAt,
        lastUpdatedBy,
        setLastUpdatedBy,
        cityCategories,
        generateActivitiesForCategory,
        categoryActivities,
        recentSearches,
        selectedCityLocation,
        tripTitle,
        setTripTitle,
        addToDeletedSavedPlaces,
        deletedSavedPlaceIds,
        isDeletedSavedPlace,
    } = useCreateTrip();
    // Primary tab state for Overview/Itinerary toggle
    type PrimaryTab = 'overview' | 'itinerary';
    // If coming from saved places, start on itinerary tab instead of overview
    const [primaryTab, setPrimaryTab] = useState<PrimaryTab>(
        fromSavedPlaces === 'true' ? 'itinerary' : 'overview'
    );

    const [activeTab, setActiveTab] = useState<TabType>('wishlist');
    const [shouldScrollToActive, setShouldScrollToActive] = useState(false);

    // Date picker modal state
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [routeData, setRouteData] = useState<RouteData>({
        polyline: [],
        legs: [],
        totalDistance: 0,
        totalDuration: '',
        travelMode: 'DRIVE'
    });
    const [routeLoading, setRouteLoading] = useState(false);
    const routeCache = useRef<{ [tab: string]: { activitiesHash: string, routeData: RouteData } }>({});
    // Ref to always have access to the latest routeData (for use in callbacks without stale closures)
    const routeDataRef = useRef<RouteData>(routeData);
    // Ref to store transport mode overrides from operations (persisted across collaborators)
    // Key format: `${dayNumber}_${originInstanceId}` -> TravelMode
    const transportModeOverridesRef = useRef<TransportModeOverrides>({});
    // Ref to prevent duplicate overview route prefetching
    const overviewRoutesFetchedRef = useRef(false);

    // State for SearchBar and AutocompleteModal
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [isAutocompleteAddingPlace, setIsAutocompleteAddingPlace] = useState(false);
    const [isShareModalVisible, setIsShareModalVisible] = useState(false);
    const [currentUserID, setCurrentUserID] = useState<string>('');

    // State for CategoryModal
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [loadingCategoryActivities, setLoadingCategoryActivities] = useState(false);
    const [loadingMoreCategoryActivities, setLoadingMoreCategoryActivities] = useState(false);

    // State for saved places
    const [allSavedPlaces, setAllSavedPlaces] = useState<any[]>([]);
    const [loadingSavedPlaces, setLoadingSavedPlaces] = useState(false);
    const [displayCityName, setDisplayCityName] = useState<string>(''); // Short city name for display
    const processedSavedPlacesRef = useRef<Set<string>>(new Set()); // Track processed savedPlaceIds to prevent duplicates

    // State for activity detail view
    const [selectedActivityForDetail, setSelectedActivityForDetail] = useState<Activity | null>(null);
    const [showActivityDetail, setShowActivityDetail] = useState(false);

    // State for selected marker
    const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

    // State for scroll positions per day
    const [dayScrollPositions, setDayScrollPositions] = useState<{ [key: number]: number }>({});
    const [shouldRestoreScrollPositions, setShouldRestoreScrollPositions] = useState<{ [key: number]: boolean }>({});

    // Refs for wishlist scroll position
    const wishlistScrollPosRef = useRef(0);
    const wishlistScrollViewRef = useRef<ScrollView>(null);

    // State for transportation settings modal
    const [settingsModalVisible, setSettingsModalVisible] = useState(false);
    const [selectedLegIndex, setSelectedLegIndex] = useState<number | null>(null);
    const [modalOriginActivity, setModalOriginActivity] = useState<Activity | undefined>(undefined);
    const [modalDestinationActivity, setModalDestinationActivity] = useState<Activity | undefined>(undefined);

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
                friction: 12,
            }).start();
        }
    };

    // Save-in-progress lock to prevent concurrent saves and duplicate tripID generation
    const [isSaving, setIsSaving] = useState(false);
    const isSavingRef = useRef(false);

    // Ref for immediate tripID access (avoids async state update issues)
    const tripIdRef = useRef(tripId);

    // Reset overview route prefetch flag when trip changes
    useEffect(() => {
        overviewRoutesFetchedRef.current = false;
    }, [tripId]);

    // ===== REMOVED: Version-based autosave refs =====
    // - versionRef: No longer using optimistic locking
    // - autosaveIntervalRef: Removed 5-minute periodic autosave
    // - saveDebounceTimeoutRef: Not needed with operation-based saves

    // Track last save time to prevent duplicate rapid-fire saves (still used for background save)
    const lastSaveTimeRef = useRef<number>(0);

    // Minimum time between autosaves (in milliseconds) - 5 seconds (still used for background save)
    const MIN_AUTOSAVE_INTERVAL = 5000;

    // Track if currently reloading from subscription to prevent autosave
    const isReloadingRef = useRef(false);

    // Track screen focus state for subscription management
    const [isScreenFocused, setIsScreenFocused] = useState(true);

    // ===== OPERATION TRACKING STATE (Stage 1) =====
    // Operation log for tracking changes
    const operationLogRef = useRef<Operation[]>([]);

    // Sequence counter for deterministic ordering
    const operationSequenceRef = useRef<number>(0);

    // Maximum operation log size to prevent memory exhaustion
    const MAX_OPERATION_LOG_SIZE = 1000;
    const MAX_APPLIED_OPERATIONS = 100;

    // Save queue for batching operations (100-300ms coalescing)
    const saveQueueRef = useRef<{
        operations: Operation[];
        timeoutId: NodeJS.Timeout | null;
        isProcessing: boolean;
    }>({
        operations: [],
        timeoutId: null,
        isProcessing: false,
    });

    // Track if we're currently capturing operations (prevent during restore)
    const isCapturingOperations = useRef(true);

    // ===== OPERATION SYNC STATE (Stage 3) =====
    // Track last operation timestamp we've processed from other users
    const lastProcessedOperationTimestampRef = useRef<number>(0);

    // Track if we're currently syncing operations (prevent concurrent syncs)
    const isSyncingOperationsRef = useRef<boolean>(false);

    // Track if a sync was requested while another sync was in progress
    const pendingSyncRef = useRef<boolean>(false);

    // Track if we're applying remote operations (disable autosave during sync)
    const isApplyingRemoteOperationsRef = useRef<boolean>(false);

    // Track which remote operations we've already applied (per opId) to prevent duplicates
    const appliedOperationIdsRef = useRef<Set<string>>(new Set());

    // Keep tripIdRef in sync with tripId state
    useEffect(() => {
        tripIdRef.current = tripId;
    }, [tripId]);

    // Keep routeDataRef in sync with routeData state (for use in callbacks without stale closures)
    useEffect(() => {
        routeDataRef.current = routeData;
    }, [routeData]);

    // Ref to track current activeTab for use in callbacks
    const activeTabRef = useRef(activeTab);
    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

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

    // ===== REMOVED: versionRef sync =====
    // No longer tracking versions - using operation-based architecture

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
                // More sensitive thresholds for better responsiveness
                const swipeThreshold = 20; // Reduced from 50 to 20 for more sensitive distance detection
                const swipeVelocityThreshold = 0.2; // Reduced from 0.5 to 0.2 for more sensitive velocity detection

                const currentState = currentHeightStateRef.current; // Use ref for current value
                let newState = currentState;

                // Check for swipe up (negative dy) - go one step higher
                // Accept EITHER sufficient distance OR sufficient velocity
                if (gestureState.dy < -swipeThreshold || gestureState.vy < -swipeVelocityThreshold) {
                    newState = Math.min(currentState + 1, 2); // Max state is 2
                }
                // Check for swipe down (positive dy) - go one step lower
                // Accept EITHER sufficient distance OR sufficient velocity
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
        removeLodgingStayByPlaceId,
    } = useDayActivities();

    // Refs to track latest trip data for autosave (avoid stale closures)
    const latestTripDataRef = useRef({
        activities,
        dayActivities,
        dayPolylines,
        dayTravelModes,
        tripLength,
        selectedCity,
        tripPhotoReference,
        createdAt,
        recentSearches,
        deletedSavedPlaceIds,
        startDate,
        endDate,
        tripTitle,
    });

    // Keep latestTripDataRef in sync with the latest values
    useEffect(() => {
        latestTripDataRef.current = {
            activities,
            dayActivities,
            dayPolylines,
            dayTravelModes,
            tripLength,
            selectedCity,
            tripPhotoReference,
            createdAt,
            recentSearches,
            deletedSavedPlaceIds,
            startDate,
            endDate,
            tripTitle,
        };
    }, [activities, dayActivities, dayPolylines, dayTravelModes, tripLength, selectedCity, tripPhotoReference, createdAt, recentSearches, deletedSavedPlaceIds, tripTitle, startDate, endDate]);

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
                // Determine source location (for move operations)
                let sourceLocation: 'wishlist' | number = 'wishlist';
                if (activeTab.startsWith('day')) {
                    sourceLocation = parseInt(activeTab.replace('day', ''));
                }

                // Transfer to the selected tab
                if (tab === 'wishlist') {
                    // Transfer to wishlist from the current day
                    const currentDayNumber = typeof sourceLocation === 'number' ? sourceLocation : 1;
                    const activityIds = selectedActivitiesList
                        .map(a => a.instanceId)
                        .filter((id): id is string => typeof id === 'string');

                    const transferredActivities = transferActivitiesToWishlist(activityIds, currentDayNumber);

                    // Add the transferred activities back to the wishlist (prepend to top)
                    if (transferredActivities.length > 0) {
                        addActivitiesToWishlist(transferredActivities, true);

                        // ✨ NEW: Track operation: move activities to wishlist (atomic shape)
                        // Include insertIndex to preserve order during reconstruction
                        transferredActivities.forEach((activity, index) => {
                            const op = createOperation('move', 'wishlist', {
                                activity: activity,
                                fromLocation: sourceLocation,
                                toLocation: 'wishlist',
                                insertIndex: index // Position in the transferred batch (0-based)
                            });
                            queueSave(op);
                        });
                    }
                } else if (tab.startsWith('day')) {
                    // Transfer to the selected day
                    const dayNumber = parseInt(tab.replace('day', ''));
                    transferActivitiesToDay(selectedActivitiesList, dayNumber);

                    // ✨ NEW: Track operation: move activities to day (atomic shape)
                    selectedActivitiesList.forEach((activity: Activity) => {
                        const op = createOperation('move', 'day', {
                            activity: activity,
                            fromLocation: sourceLocation,
                            toLocation: dayNumber
                        }, dayNumber);
                        queueSave(op);
                    });
                }

                // Clear selection after transfer
                clearSelection();
            }
        } else {
            // No selected activities, just clear selection
            clearSelection();
        }

        // If clicking Overview tab in TabBar, switch back to primary Overview mode
        if (tab === 'overview' && primaryTab === 'itinerary') {
            setPrimaryTab('overview');
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
        } else if (tab === 'wishlist') {
            // Restore wishlist scroll position
            setTimeout(() => {
                wishlistScrollViewRef.current?.scrollTo({ 
                    y: wishlistScrollPosRef.current, 
                    animated: false 
                });
            }, 100);
        }
    };

    // Handler for when a day card is pressed in Overview mode
    const handleOverviewDayPress = (dayNumber: number) => {
        setPrimaryTab('itinerary');
        setActiveTab(`day${dayNumber}` as TabType);
        setShouldScrollToActive(true);
    };

    // Handler for background tap to deselect activities
    const handleBackgroundTap = () => {
        if (isSelectionMode && selectedActivities.length > 0) {
            clearSelection();
        }
    };

    // Helper function to convert Activity to ActivityInput format for GraphQL
    // Helper function to recursively remove __typename and extra fields not in ActivityInput schema
    const removeTypename = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => removeTypename(item));
        }
        if (typeof obj === 'object') {
            const cleaned: any = {};
            // Fields to exclude: __typename and fields not in GraphQL ActivityInput schema
            const excludedFields = ['__typename', 'lastModified', 'modifiedBy', 'lastReordered', 'category'];
            for (const key in obj) {
                if (!excludedFields.includes(key)) {
                    cleaned[key] = removeTypename(obj[key]);
                }
            }
            return cleaned;
        }
        return obj;
    };

    const formatActivityForInput = (activity: Activity): any => {
        const activityInput = {
            instanceId: activity.instanceId || null,
            place_id: activity.place_id || '',
            name: activity.name || '',
            city: activity.city || null,
            lat: activity.lat || 0,
            lng: activity.lng || 0,
            rating: activity.rating || null,
            types: activity.types || null,
            primaryType: activity.primaryType || null,
            photo_reference: activity.photo_reference || null,
            formatted_address: activity.formatted_address || null,
            user_ratings_total: activity.user_ratings_total || null,
            is_recommended: activity.is_recommended || null,
            display_name: activity.display_name || null,
            website_uri: activity.website_uri || null,
            regular_opening_hours: activity.regular_opening_hours || null,
            reviews: activity.reviews || null,
            editorial_summary: activity.editorial_summary || null,
            primary_type_display_name: activity.primary_type_display_name || null,
            international_phone_number: activity.international_phone_number || null,
            notes: activity.notes || null,
            startTime: activity.startTime || null,
            endTime: activity.endTime || null,
            isLodging: activity.isLodging || null,
            lodgingCheckIn: activity.lodgingCheckIn || null,
            lodgingCheckOut: activity.lodgingCheckOut || null,
            lodgingTime: activity.lodgingTime || null,
        };
        // Recursively remove all __typename fields
        return removeTypename(activityInput);
    };

    // Helper function to convert Collaborator to CollaboratorInput format for GraphQL
    const formatCollaboratorForInput = (collaborator: any): any => {
        const collaboratorInput = {
            email: collaborator.email || '',
            fullName: collaborator.fullName || '',
            username: collaborator.username || '',
            userID: collaborator.userID || '',
            role: collaborator.role || 'viewer',
            addedBy: collaborator.addedBy || '',
        };
        // Recursively remove all __typename fields
        return removeTypename(collaboratorInput);
    };

    // Helper function to convert CategoryItem to CategoryItemInput format for GraphQL
    const formatCategoryItemForInput = (item: any): any => {
        return {
            category: item.category || '',
            category_items: item.category_items || [],
            emoji: item.emoji || null,
        };
    };

    // Helper function to convert RecentSearch to RecentSearchInput format for GraphQL
    const formatRecentSearchForInput = (search: any): any => {
        return {
            place_id: search.place_id || '',
            name: search.name || '',
            address_info: search.address_info || null,
            timestamp: search.timestamp || '',
        };
    };

    // Helper function to save trip to backend (updates main TripStorage record)
    const saveTripToBackend = async (updatedTripTitle?: string) => {
        if (!tripId || !currentUserID) {
            console.log('[trip-view_main] Cannot save - missing tripId or currentUserID');
            return;
        }

        try {
            console.log('[trip-view_main] Saving trip to TripStorage...');

            // Format days data
            const sortedDayNumbers = Object.keys(dayActivities)
                .map(Number)
                .sort((a, b) => a - b);

            const daysArray = sortedDayNumbers.map((dayNum) => {
                const dayData = dayActivities[dayNum];
                return {
                    dayNumber: dayNum,
                    activities: (dayData?.activities || []).map(formatActivityForInput),
                    encodedPolyline: dayPolylines[dayNum] || null,
                    travelModes: dayTravelModes[dayNum] ? JSON.stringify(dayTravelModes[dayNum]) : null
                };
            });

            // Build input for createTrip mutation
            // CRITICAL: Preserve existing tripTitle if not explicitly being updated
            // If updatedTripTitle is explicitly passed (even as null), use it
            // Otherwise, use current tripTitle state
            // This prevents autosave from overwriting custom titles with null
            const finalTripTitle = updatedTripTitle !== undefined ? updatedTripTitle : tripTitle;
            console.log('[saveTripToBackend] updatedTripTitle param:', updatedTripTitle);
            console.log('[saveTripToBackend] current tripTitle state:', tripTitle);
            console.log('[saveTripToBackend] 📤 Final tripTitle to save:', finalTripTitle);
            console.log('[saveTripToBackend] 🔢 Current version state:', version);
            console.log('[saveTripToBackend] 🔢 Next version to save:', (version || 0) + 1);

            const tripInput = {
                tripId: tripId,
                tripTitle: finalTripTitle,
                userID: currentUserID,
                days: daysArray,
                wishlist: (activities || []).map(formatActivityForInput),
                tripLength: tripLength,
                selectedCity: selectedCity,
                tripPhotoReference: tripPhotoReference || [],
                createdAt: createdAt,
                startDate: startDate,
                endDate: endDate,
                collaborators: (collaborators || []).map(formatCollaboratorForInput),
                version: (version || 0) + 1,
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: currentUserID,
                cityCategories: (cityCategories || []).map(formatCategoryItemForInput),
                recentSearches: (recentSearches || []).map(formatRecentSearchForInput)
            };

            // Log the trip input for debugging
            console.log('[trip-view_main] Sending to createTrip mutation:', {
                tripId: tripInput.tripId,
                tripTitle: tripInput.tripTitle,
                userID: tripInput.userID,
                daysCount: tripInput.days.length,
                wishlistCount: tripInput.wishlist.length,
                collaboratorsCount: tripInput.collaborators.length,
            });

            // Log the FULL tripInput object to see everything
            console.log('[trip-view_main] FULL tripInput object:', JSON.stringify({
                tripId: tripInput.tripId,
                tripTitle: tripInput.tripTitle,
                userID: tripInput.userID,
                selectedCity: tripInput.selectedCity,
                tripLength: tripInput.tripLength,
                version: tripInput.version,
                startDate: tripInput.startDate,
                endDate: tripInput.endDate,
                createdAt: tripInput.createdAt,
                updatedAt: tripInput.updatedAt,
                lastUpdatedBy: tripInput.lastUpdatedBy,
            }, null, 2));

            // Log full activities to debug schema mismatch
            if (tripInput.wishlist && tripInput.wishlist.length > 0) {
                console.log('[trip-view_main] First wishlist activity:', JSON.stringify(tripInput.wishlist[0], null, 2));
            }
            if (tripInput.days && tripInput.days.length > 0 && tripInput.days[0].activities.length > 0) {
                console.log('[trip-view_main] First day activity:', JSON.stringify(tripInput.days[0].activities[0], null, 2));
            }
            if (tripInput.collaborators && tripInput.collaborators.length > 0) {
                console.log('[trip-view_main] First collaborator:', JSON.stringify(tripInput.collaborators[0], null, 2));
            }

            // Call createTrip mutation via GraphQL
            // Remove all __typename fields to prevent GraphQL validation errors
            const cleanedTripInput = removeTypename(tripInput);
            const result: any = await API.graphql(graphqlOperation(createTrip, { input: cleanedTripInput }));

            console.log('[trip-view_main] createTrip mutation result:', {
                tripId: result?.data?.createTrip?.tripId,
                tripTitle: result?.data?.createTrip?.tripTitle,
                version: result?.data?.createTrip?.version,
                fullResult: JSON.stringify(result?.data?.createTrip).substring(0, 200),
            });

            // Verify the save worked
            const savedTitle = result?.data?.createTrip?.tripTitle;
            const savedVersion = result?.data?.createTrip?.version;

            if (savedTitle !== tripInput.tripTitle) {
                console.error('[trip-view_main] ⚠️ WARNING: Saved title mismatch!', {
                    sent: tripInput.tripTitle,
                    returned: savedTitle
                });
            }

            if (savedVersion !== tripInput.version) {
                console.error('[trip-view_main] ⚠️ WARNING: Version mismatch!', {
                    sent: tripInput.version,
                    returned: savedVersion
                });
            }

            // Update local state WITH THE VALUES RETURNED FROM BACKEND
            // CRITICAL: Use values from backend response to ensure consistency
            if (savedVersion) {
                console.log('[trip-view_main] 🔄 Updating local version from', version, 'to', savedVersion);
                setVersion(savedVersion);
            } else {
                console.warn('[trip-view_main] ⚠️ Backend did not return version, keeping local version');
            }

            // Update tripTitle state if we saved a new title
            if (updatedTripTitle !== undefined && savedTitle === updatedTripTitle) {
                console.log('[trip-view_main] 🔄 Confirming tripTitle state update to:', savedTitle);
                setTripTitle(savedTitle);
            }

            console.log('[trip-view_main] ✅ Trip saved to TripStorage successfully');
        } catch (error) {
            console.error('[trip-view_main] ❌ Failed to save trip to TripStorage:', error);
            throw error;
        }
    };

    // Handler for trip title changes
    const handleTitleChange = async (newTitle: string) => {
        console.log('[trip-view_main] handleTitleChange called with:', newTitle);
        console.log('[trip-view_main] Current tripTitle:', tripTitle);
        setTripTitle(newTitle);

        // Save to backend if trip exists
        if (tripId) {
            try {
                // 1. Log operation for event sourcing
                console.log('[trip-view_main] Saving trip title to backend via operation');
                const op = createOperation('modify', 'trip', {
                    field: 'tripTitle',
                    value: newTitle
                });
                await queueSave(op);
                console.log('[trip-view_main] Trip title operation queued successfully');

                // 2. Update main trip record in TripStorage
                await saveTripToBackend(newTitle);
                console.log('[trip-view_main] Trip title saved to TripStorage successfully');
            } catch (error) {
                console.error('[trip-view_main] Failed to save trip title:', error);
            }
        } else {
            console.log('[trip-view_main] No tripId, skipping backend save');
        }
    };

    // Handler for date changes (from SimpleDatePicker)
    const handleDateChange = async (newStartDate: string | null, newEndDate: string | null, newTripLength: number) => {
        const oldTripLength = tripLength;

        // Update state
        setStartDate(newStartDate);
        setEndDate(newEndDate);
        setTripLength(newTripLength);

        // Immediately update refs to ensure saveTrip uses the latest values
        latestTripDataRef.current.startDate = newStartDate;
        latestTripDataRef.current.endDate = newEndDate;
        latestTripDataRef.current.tripLength = newTripLength;

        // Handle day count changes
        if (newTripLength > oldTripLength) {
            // Add new empty days using addMultipleDays to avoid state batching issues
            const daysToAdd = newTripLength - oldTripLength;
            addMultipleDays(daysToAdd);
        } else if (newTripLength < oldTripLength) {
            // Automatically remove days when reducing trip length via calendar
            // Remove days from highest to lowest to avoid index shifting issues
            for (let i = oldTripLength; i > newTripLength; i--) {
                // Get activities from the day being deleted
                const dayActivitiesToDelete = getDayActivities(i);

                // Delete the day
                const deletedDayActivities = deleteDayAndRenumber(i);

                // Add non-lodging activities back to wishlist
                if (deletedDayActivities.length > 0) {
                    const nonLodgingActivities = deletedDayActivities.filter(
                        activity => {
                            if (activity.isLodging === true) return false;
                            if (activity.primaryType === 'lodging') return false;
                            if (activity.types && Array.isArray(activity.types)) {
                                const hasLodgingType = activity.types.some(type =>
                                    type && (
                                        type.toLowerCase().includes('lodging') ||
                                        type.toLowerCase().includes('hotel') ||
                                        type.toLowerCase().includes('hostel') ||
                                        type.toLowerCase().includes('accommodation') ||
                                        type.toLowerCase().includes('campground') ||
                                        type.toLowerCase().includes('rv_park')
                                    )
                                );
                                if (hasLodgingType) return false;
                            }
                            return true;
                        }
                    );

                    const combinedActivities = [...nonLodgingActivities, ...(activities || [])];
                    const deduplicatedActivities = combinedActivities.filter((activity, index, arr) => {
                        if (!activity.instanceId) return true;
                        return arr.findIndex(a => a.instanceId === activity.instanceId) === index;
                    });
                    updateActivities(deduplicatedActivities);
                }
            }

            // Clear route cache for deleted days
            Object.keys(routeCache.current).forEach(cacheKey => {
                if (cacheKey.startsWith('day')) {
                    const cachedDayNum = parseInt(cacheKey.replace('day', ''));
                    if (cachedDayNum > newTripLength) {
                        delete routeCache.current[cacheKey];
                    }
                }
            });

            // Update polylines
            setDayPolylinesDeleteDay(prev => {
                const newPolylines: { [key: number]: string } = {};
                Object.entries(prev).forEach(([dayStr, polyline]) => {
                    const dayNum = Number(dayStr);
                    if (dayNum <= newTripLength) {
                        newPolylines[dayNum] = polyline as string;
                    }
                });
                return newPolylines;
            });
        }

        // Save full trip to persist dates to backend
        if (tripId) {
            try {
                await saveTrip();
            } catch (error) {
                console.error('[trip-view_main] Failed to save trip dates:', error);
            }
        }
    };

    // Get all activities from the entire trip (trip saved places + all days)
    const getAllActivitiesFromTrip = () => {
        const trip_saved_places_activities = activities || [];
        const allDayActivities = Object.values(dayActivities || {})
            .flatMap(dayObj => Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : []);
        return [...trip_saved_places_activities, ...allDayActivities];
    };

    // Get only day activities (excluding wishlist)
    const getAllDayActivities = () => {
        const allDayActivities = Object.values(dayActivities || {})
            .flatMap(dayObj => Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : []);
        return allDayActivities;
    };

    // Get activities for the current tab
    const getActivitiesForTab = (tab: TabType) => {
        if (tab === 'wishlist') {
            // Get all activities from days
            const allDayActivitiesList = Object.values(dayActivities || {})
                .flatMap(dayObj => Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : []) as Activity[];

            // Create a set of instanceIds from day activities for quick lookup
            const dayActivityInstanceIds = new Set(
                allDayActivitiesList.map((activity: Activity) => activity.instanceId).filter(Boolean)
            );

            // Create a set of savedPlaceId + place_id combinations from day activities
            // This is used to filter out Instagram-saved places that have been moved to days
            const dayActivitySavedPlaceKeys = new Set(
                allDayActivitiesList
                    .filter((activity: Activity) => activity.savedPlaceId && activity.place_id)
                    .map((activity: Activity) => `${activity.savedPlaceId}_${activity.place_id}`)
            );

            return (activities || []).filter((activity: Activity) => {
                // First check: filter by instanceId (existing logic)
                if (activity.instanceId && dayActivityInstanceIds.has(activity.instanceId)) {
                    return false;
                }

                // Second check: for Instagram-saved places, filter if same savedPlaceId AND place_id exists in days
                if (activity.savedPlaceId && activity.place_id) {
                    const key = `${activity.savedPlaceId}_${activity.place_id}`;
                    if (dayActivitySavedPlaceKeys.has(key)) {
                        return false;
                    }
                }

                return true;
            });
        } else {
            // Extract day number from tab (e.g., 'day2' -> 2)
            const dayNumber = parseInt(tab.replace('day', ''));
            return getDayActivities(dayNumber) || [];
        }
    };

    // ===== OPERATION TRACKING FUNCTIONS (Stage 1) =====

    /**
     * Create a new operation with validation
     */
    const createOperation = useCallback((
        type: Operation['type'],
        target: Operation['target'],
        data: any,
        dayNumber?: number
    ): Operation | null => {
        // Guard: Don't track operations if capturing is disabled (e.g., during restore)
        if (!isCapturingOperations.current) {
            console.log('[createOperation] Skipping - not capturing');
            return null;
        }

        // Guard: Don't track when applying remote operations (Stage 3)
        if (isApplyingRemoteOperationsRef.current) {
            console.log('[createOperation] Skipping - applying remote operations');
            return null;
        }

        // Guard: Don't track for viewers
        if (currentUserRole === 'viewer') {
            console.log('[createOperation] Skipping - viewer role');
            return null;
        }

        // Guard: Must have a tripId
        if (!tripIdRef.current) {
            console.log('[createOperation] Skipping - no tripId');
            return null;
        }

        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);

        // Increment sequence number for deterministic ordering
        operationSequenceRef.current += 1;
        const sequenceNumber = operationSequenceRef.current;

        const opId = `${currentUserID}_${type}_${target}_${dayNumber || 'none'}_${timestamp}_${random}`;

        const operation: Operation = {
            tripID: tripIdRef.current,
            timestamp,
            opId,
            userId: currentUserID,
            sequenceNumber,
            type,
            target,
            dayNumber,
            data,
            applied: false,
        };

        console.log('[createOperation] Created:', type, target, dayNumber || '');

        return operation;
    }, [currentUserID, currentUserRole]);

    /**
     * Queue an operation and trigger coalesced save
     */
    const queueSave = useCallback((operation: Operation | null) => {
        if (!operation) {
            return;
        }

        // Validate operation belongs to current trip
        if (operation.tripID !== tripIdRef.current) {
            console.error('[queueSave] Operation tripId mismatch!');
            return;
        }

        console.log('[queueSave] Queuing operation:', operation.type, operation.target);

        // Add to operation log
        operationLogRef.current.push(operation);

        // Enforce max operation log size
        if (operationLogRef.current.length > MAX_OPERATION_LOG_SIZE) {
            console.log('[queueSave] Cleaning operation log (exceeds', MAX_OPERATION_LOG_SIZE, ')');

            // Keep unapplied operations (critical - not saved yet)
            const unapplied = operationLogRef.current.filter(op => !op.applied);

            // Keep most recent applied operations from THIS user only
            const applied = operationLogRef.current
                .filter(op => op.applied && op.userId === currentUserID)
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, MAX_APPLIED_OPERATIONS);

            operationLogRef.current = [...unapplied, ...applied];

            console.log('[queueSave] Cleaned:', {
                unapplied: unapplied.length,
                applied: applied.length,
                total: operationLogRef.current.length
            });
        }

        // Add to save queue
        saveQueueRef.current.operations.push(operation);

        // Clear existing timeout
        if (saveQueueRef.current.timeoutId) {
            clearTimeout(saveQueueRef.current.timeoutId);
        }

        // Coalescing delay:
        // - 100ms if first operation (feels instant)
        // - 300ms if batching (allow time for more changes)
        const delay = saveQueueRef.current.operations.length === 1 ? 100 : 300;

        saveQueueRef.current.timeoutId = setTimeout(() => {
            processSaveQueue();
        }, delay);
    }, [currentUserID]);

    /**
     * Process queued operations and save to DynamoDB
     */
    const processSaveQueue = useCallback(async () => {
        // Already processing or nothing to save
        if (saveQueueRef.current.isProcessing || saveQueueRef.current.operations.length === 0) {
            return;
        }

        // Don't save during reload
        if (isReloadingRef.current) {
            console.log('[processSaveQueue] Skipping (reloading)');
            setTimeout(() => processSaveQueue(), 1000);
            return;
        }

        saveQueueRef.current.isProcessing = true;
        const opsToSave = [...saveQueueRef.current.operations];
        saveQueueRef.current.operations = []; // Clear queue

        console.log(`[processSaveQueue] Saving ${opsToSave.length} operations`);

        try {
            // Save all operations in parallel (append-only - no conflicts!)
            const results = await Promise.allSettled(
                opsToSave.map(op => saveOperation(op))
            );

            // Check results
            const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
            const failed = results.filter(r => r.status === 'rejected' || !r.value).length;

            console.log(`[processSaveQueue] Saved ${succeeded}/${opsToSave.length} operations`);

            // Mark successful operations as applied
            opsToSave.forEach((op, i) => {
                const result = results[i];
                if (result.status === 'fulfilled' && result.value) {
                    op.applied = true;
                }
            });

            if (failed > 0) {
                console.warn(`[processSaveQueue] ${failed} operations failed - will retry`);

                // Put failed operations back in queue
                const failedOps = opsToSave.filter((op, i) => {
                    const result = results[i];
                    return result.status === 'rejected' || !result.value;
                });

                saveQueueRef.current.operations.unshift(...failedOps);

                // Retry after delay
                setTimeout(() => processSaveQueue(), 2000);
            }

            // STAGE 2 NOTE: Automatic verification disabled for the user making changes
            // Verification should run on the RECEIVING end (User Y/Z), not the sending end (User X)
            // The user making changes already has the correct state
            // Use global.verifyTrip() to manually test reconstruction logic during development

        } catch (error: any) {
            console.error('[processSaveQueue] Unexpected error:', error);

            // Put operations back in queue
            saveQueueRef.current.operations.unshift(...opsToSave);

            // Retry
            setTimeout(() => processSaveQueue(), 2000);

        } finally {
            saveQueueRef.current.isProcessing = false;
        }
    }, []);

    // Cleanup save queue on unmount
    useEffect(() => {
        return () => {
            if (saveQueueRef.current.timeoutId) {
                clearTimeout(saveQueueRef.current.timeoutId);
            }
        };
    }, []);

    // ===== OPERATION SYNC FUNCTIONS (Stage 3) =====

    /**
     * Sync new operations from other users
     * Fetches operations with timestamp > lastProcessedTimestamp and applies them incrementally
     */
    const syncNewOperations = useCallback(async () => {
        if (isSyncingOperationsRef.current) {
            console.log('[syncNewOperations] Already syncing - marking pending sync');
            pendingSyncRef.current = true;
            return;
        }

        if (!tripId) {
            console.log('[syncNewOperations] No tripId - skipping');
            return;
        }

        if (!currentUserID) {
            console.log('[syncNewOperations] No currentUserID - skipping');
            return;
        }

        isSyncingOperationsRef.current = true;
        pendingSyncRef.current = false; // Clear pending flag as we're starting a sync
        const syncStartTime = Date.now();

        try {
            console.log('[syncNewOperations] 🔄 Starting sync for trip:', tripId);
            console.log('[syncNewOperations] Last processed timestamp:', lastProcessedOperationTimestampRef.current);

            // 1. Fetch ALL operations for this trip
            const allOperations = await listOperations(tripId);
            console.log('[syncNewOperations] Fetched', allOperations.length, 'total operations');

            // 2. Filter to only NEW operations:
            //    - timestamp > lastProcessed
            //    - not our own userId
            //    - not already applied (by opId)
            const newOperations = allOperations.filter(
                op =>
                    op.timestamp > lastProcessedOperationTimestampRef.current &&
                    op.userId !== currentUserID && // Skip our own operations
                    !appliedOperationIdsRef.current.has(op.opId) // Skip ops we've already applied
            );

            if (newOperations.length === 0) {
                // Debug: check why no operations passed the filter
                const newerOps = allOperations.filter(op => op.timestamp > lastProcessedOperationTimestampRef.current);
                const ownOpsFiltered = newerOps.filter(op => op.userId === currentUserID);
                const alreadyApplied = newerOps.filter(op => op.userId !== currentUserID && appliedOperationIdsRef.current.has(op.opId));
                console.log('[syncNewOperations] ✅ No new operations to sync');
                console.log('[syncNewOperations] Debug - newer ops:', newerOps.length, 'own ops filtered:', ownOpsFiltered.length, 'already applied:', alreadyApplied.length);
                isSyncingOperationsRef.current = false;

                // Check if there's a pending sync request
                if (pendingSyncRef.current) {
                    console.log('[syncNewOperations] Pending sync detected after no-op - triggering now');
                    pendingSyncRef.current = false;
                    // Use setTimeout to avoid recursion and let the call stack clear
                    setTimeout(() => {
                        syncNewOperations();
                    }, 0);
                }
                return;
            }

            console.log('[syncNewOperations] 🆕 Found', newOperations.length, 'new operations from other users');

            // 3. Get current state from context
            // Calculate trip saved places (activities not assigned to any day) using instanceId membership
            const dayActivityInstanceIds = Object.values(dayActivities || {})
                .flatMap((day: any) =>
                    Array.isArray(day.activities)
                        ? day.activities.map((a: Activity) => a.instanceId)
                        : []
                )
                .filter((id): id is string => Boolean(id));

            const trip_saved_places_activities =
                (activities || []).filter(
                    (a: Activity) =>
                        !a.instanceId || !dayActivityInstanceIds.includes(a.instanceId)
                ) || [];
            const currentState: ReconstructedTripState = {
                wishlist: trip_saved_places_activities,
                dayActivities: dayActivities || {}
            };

            console.log('[syncNewOperations] Current state - wishlist:', currentState.wishlist.length, 'days:', Object.keys(currentState.dayActivities).length);

            // 4. Apply new operations incrementally using reduce
            const updatedState = newOperations.reduce((state, operation) => {
                console.log('[syncNewOperations] Applying:', operation.type, operation.opId);
                // Cast to AnyOperation to satisfy applyOperation's type without changing runtime shape
                return applyOperation(state, operation as any);
            }, currentState);

            console.log('[syncNewOperations] Updated state - wishlist:', updatedState.wishlist.length, 'days:', Object.keys(updatedState.dayActivities).length);

            // Check if any day deletions occurred that affect the current active tab
            const dayDeletions = newOperations.filter(
                op => op.type === 'remove' && op.target === 'day' && (op.data as any)?.action === 'deleteDay'
            );

            // 5. Update local state with reconstructed data
            // CRITICAL: Set flag to prevent createOperation from firing during state updates
            isApplyingRemoteOperationsRef.current = true;

            try {
                // Update trip saved places
                if (JSON.stringify(currentState.wishlist) !== JSON.stringify(updatedState.wishlist)) {
                    console.log('[syncNewOperations] Updating wishlist...');
                    updateActivities(updatedState.wishlist);
                }

                // Update all day activities if they differ from current state
                if (JSON.stringify(currentState.dayActivities) !== JSON.stringify(updatedState.dayActivities)) {
                    console.log(
                        '[syncNewOperations] Updating dayActivities from remote operations. Days:',
                        Object.keys(updatedState.dayActivities).length
                    );
                    // Replace the entire dayActivities map to ensure deletes/renumbering are applied
                    setDayActivities(updatedState.dayActivities as any);

                    // Handle tab switching if days were deleted
                    if (dayDeletions.length > 0 && activeTab.startsWith('day')) {
                        const currentDayNumber = parseInt(activeTab.replace('day', ''));

                        // Find if any deleted day affects our current tab
                        // Days are deleted in order, and subsequent days are renumbered
                        let deletedDaysBefore = 0;
                        let currentDayWasDeleted = false;

                        dayDeletions.forEach(delOp => {
                            const deletedDayNum = delOp.dayNumber;
                            if (deletedDayNum === currentDayNumber) {
                                currentDayWasDeleted = true;
                            } else if (deletedDayNum && deletedDayNum < currentDayNumber) {
                                deletedDaysBefore++;
                            }
                        });

                        const remainingDays = Object.keys(updatedState.dayActivities).length;

                        if (currentDayWasDeleted) {
                            // Our current day was deleted - switch to appropriate tab
                            console.log('[syncNewOperations] Current day', currentDayNumber, 'was deleted - switching tab');

                            if (remainingDays === 0 || currentDayNumber === 1) {
                                // If no days left or day 1 was deleted, go to wishlist
                                setActiveTab('wishlist');
                            } else {
                                // Go to the previous day (after renumbering)
                                setActiveTab(`day${currentDayNumber - 1}`);
                            }
                        } else if (deletedDaysBefore > 0) {
                            // Days before us were deleted, so we've been renumbered
                            const newDayNumber = currentDayNumber - deletedDaysBefore;
                            console.log('[syncNewOperations] Current day renumbered from', currentDayNumber, 'to', newDayNumber);
                            setActiveTab(`day${newDayNumber}`);
                        }
                    }
                }

                // Update transport mode overrides if present
                if (updatedState.transportModes && Object.keys(updatedState.transportModes).length > 0) {
                    console.log('[syncNewOperations] Updating transport mode overrides:', Object.keys(updatedState.transportModes).length);
                    transportModeOverridesRef.current = {
                        ...transportModeOverridesRef.current,
                        ...updatedState.transportModes,
                    };

                    // Use refs to get latest values (avoid stale closures)
                    const currentActiveTab = activeTabRef.current;
                    const currentRouteData = routeDataRef.current;

                    // Also update context for DynamoDB persistence
                    if (currentActiveTab.startsWith('day')) {
                        const currentDayNumber = parseInt(currentActiveTab.replace('day', ''));

                        // Sync to context using legIndex for backward compatibility
                        Object.entries(updatedState.transportModes).forEach(([legKey, mode]) => {
                            const [dayStr, instanceId] = legKey.split('_');
                            const dayNum = parseInt(dayStr);
                            if (dayNum === currentDayNumber) {
                                // Find the leg index for this instanceId
                                const currentDayActivities = getActivitiesForTab(currentActiveTab);
                                const legIndex = currentDayActivities.findIndex(a => a.instanceId === instanceId);
                                if (legIndex >= 0) {
                                    setLegTravelMode(dayNum, legIndex, mode);
                                }
                            }
                        });
                    }

                    // If we're on a day tab, apply transport mode changes to current routeData
                    if (currentActiveTab.startsWith('day')) {
                        const currentDayNumber = parseInt(currentActiveTab.replace('day', ''));
                        const currentDayActivities = getActivitiesForTab(currentActiveTab);

                        // Check if any transport mode changes affect the current day
                        const relevantModes = Object.keys(updatedState.transportModes).filter(key =>
                            key.startsWith(`${currentDayNumber}_`)
                        );

                        if (relevantModes.length > 0 && currentRouteData.legs.length > 0) {
                            console.log('[syncNewOperations] Using latest routeData with', currentRouteData.legs.length, 'legs');
                            console.log('[syncNewOperations] Applying', relevantModes.length, 'transport mode changes to current day');

                            // Create a copy of legs to update (currentRouteData.legs is already EnhancedRouteLeg[])
                            const updatedLegs: EnhancedRouteLeg[] = currentRouteData.legs.map(leg => ({ ...leg }));

                            // Find legs that need mode data fetched
                            const legsNeedingFetch: { index: number; mode: TravelMode; leg: EnhancedRouteLeg }[] = [];

                            // Update the route legs with the new selected modes
                            for (let index = 0; index < updatedLegs.length; index++) {
                                const leg = updatedLegs[index];
                                const originActivity = currentDayActivities[index];
                                if (!originActivity?.instanceId) continue;

                                const legKey = `${currentDayNumber}_${originActivity.instanceId}`;
                                const overrideMode = updatedState.transportModes?.[legKey];

                                if (overrideMode && leg.selectedMode !== overrideMode) {
                                    console.log('[syncNewOperations] Updating leg', index, 'mode to', overrideMode);

                                    // Check if mode data exists for the new mode
                                    if (!leg.modeData[overrideMode]) {
                                        // Need to fetch this mode's route data
                                        legsNeedingFetch.push({
                                            index,
                                            mode: overrideMode,
                                            leg: { ...leg, selectedMode: overrideMode }
                                        });
                                    }

                                    updatedLegs[index] = {
                                        ...leg,
                                        selectedMode: overrideMode,
                                    };
                                }
                            }

                            // Fetch missing mode data from getRoute Lambda
                            if (legsNeedingFetch.length > 0) {
                                console.log('[syncNewOperations] Fetching route data for', legsNeedingFetch.length, 'legs with missing mode data');

                                // Fetch mode data in parallel
                                const fetchResults = await Promise.all(
                                    legsNeedingFetch.map(async ({ index, mode }) => {
                                        try {
                                            const legActivities = [currentDayActivities[index], currentDayActivities[index + 1]];
                                            if (!legActivities[0] || !legActivities[1]) return { index, mode, data: null };

                                            const result = await fetchRoutePolylineWithMode(legActivities, mode);
                                            return {
                                                index,
                                                mode,
                                                data: result.legs[0] ? {
                                                    distance: result.legs[0].distance,
                                                    duration: result.legs[0].duration,
                                                    polyline: result.legs[0].polyline
                                                } : null
                                            };
                                        } catch (error) {
                                            console.error(`[syncNewOperations] Error fetching ${mode} mode for leg ${index}:`, error);
                                            return { index, mode, data: null };
                                        }
                                    })
                                );

                                // Apply fetched data to legs
                                fetchResults.forEach(({ index, mode, data }) => {
                                    if (data) {
                                        const leg = updatedLegs[index];
                                        updatedLegs[index] = {
                                            ...leg,
                                            modeData: {
                                                ...leg.modeData,
                                                [mode]: data
                                            }
                                        };
                                        console.log(`[syncNewOperations] Updated leg ${index} with ${mode} data: ${data.duration}, ${data.distance}m`);
                                    } else {
                                        // Fallback to DRIVE if fetch failed
                                        const leg = updatedLegs[index];
                                        updatedLegs[index] = {
                                            ...leg,
                                            selectedMode: 'DRIVE'
                                        };
                                        console.warn(`[syncNewOperations] Fallback to DRIVE for leg ${index} - fetch failed`);
                                    }
                                });
                            }

                            // Recalculate polyline based on all selected modes
                            let newPolylineCoords: { latitude: number; longitude: number }[] = [];
                            let totalDistance = 0;
                            let totalDurationSeconds = 0;

                            for (let i = 0; i < updatedLegs.length; i++) {
                                const leg = updatedLegs[i];
                                const modeData = leg.modeData[leg.selectedMode];
                                if (modeData?.polyline) {
                                    const legCoords = decodePolyline(modeData.polyline);
                                    newPolylineCoords = [...newPolylineCoords, ...legCoords];
                                    totalDistance += modeData.distance || 0;
                                    // Parse duration string to seconds
                                    totalDurationSeconds += parseDuration(modeData.duration || '0m');
                                }
                            }

                            // Update route data with new polyline and totals
                            setRouteData(prevRouteData => ({
                                ...prevRouteData,
                                polyline: newPolylineCoords,
                                legs: updatedLegs,
                                totalDistance,
                                totalDuration: formatDuration(totalDurationSeconds),
                            }));

                            // Update route cache
                            if (routeCache.current[currentActiveTab]) {
                                routeCache.current[currentActiveTab].routeData = {
                                    ...routeCache.current[currentActiveTab].routeData,
                                    legs: updatedLegs as EnhancedRouteLeg[],
                                    polyline: newPolylineCoords,
                                    totalDistance,
                                    totalDuration: formatDuration(totalDurationSeconds),
                                };
                            }

                            console.log('[syncNewOperations] Route updated - total distance:', totalDistance, 'total duration:', formatDuration(totalDurationSeconds));
                        }
                    }
                }

                // Apply reconstructed tripTitle if it changed
                if (updatedState.tripTitle !== undefined && updatedState.tripTitle !== tripTitle) {
                    console.log('[syncNewOperations] Updating tripTitle from operations:', updatedState.tripTitle);
                    setTripTitle(updatedState.tripTitle);
                }

            } finally {
                // Re-enable operation tracking after state settles
                setTimeout(() => {
                    isApplyingRemoteOperationsRef.current = false;
                    console.log('[syncNewOperations] ✅ Remote operations applied, operation tracking re-enabled');
                }, 150);
            }

            // 6. Mark operations as applied and update last processed timestamp
            newOperations.forEach((op) => {
                appliedOperationIdsRef.current.add(op.opId);
            });
            const latestTimestamp = Math.max(...newOperations.map(op => op.timestamp));
            lastProcessedOperationTimestampRef.current = latestTimestamp;
            console.log('[syncNewOperations] Updated lastProcessedTimestamp to:', latestTimestamp);

            // 7. Recalculate routes for days affected by operations
            // Collect all days that were modified by any operation
            const affectedDays = new Set<number>();
            newOperations.forEach(op => {
                if (op.target === 'day' && op.dayNumber !== undefined) {
                    // Only recalculate for operations that change activity order/content
                    if (op.type === 'reorder' || op.type === 'add' || op.type === 'remove' || op.type === 'move') {
                        affectedDays.add(op.dayNumber);
                    }
                }
            });

            // Recalculate routes sequentially after all operations are applied
            if (affectedDays.size > 0) {
                console.log('[syncNewOperations] 🗺️ Recalculating routes for affected days:', Array.from(affectedDays));

                // Process each affected day sequentially
                for (const dayNumber of Array.from(affectedDays)) {
                    const dayTab = `day${dayNumber}`;

                    // Clear cache to force recalculation
                    delete routeCache.current[dayTab];

                    // Get activities for this day from updated state
                    const dayData = updatedState.dayActivities[dayNumber];
                    if (dayData && dayData.activities && dayData.activities.length > 1) {
                        try {
                            console.log('[syncNewOperations] Calculating route for day', dayNumber, 'with', dayData.activities.length, 'activities');

                            // Recalculate route using Google Routes API
                            const basicRouteData = await fetchRoutePolyline(dayData.activities);

                            // Update polyline in context
                            if (basicRouteData.polyline && basicRouteData.polyline.length > 1) {
                                const encoded = encodePolyline(basicRouteData.polyline);
                                setDayPolyline(dayNumber, encoded);
                                console.log('[syncNewOperations] ✅ Polyline updated for day', dayNumber);
                            }

                            // Update route data if this is the currently active tab
                            if (activeTab === dayTab) {
                                // Transform legs into EnhancedRouteLeg structure with DRIVE data only
                                const enhancedLegs: EnhancedRouteLeg[] = basicRouteData.legs.map((leg: any) => ({
                                    modeData: {
                                        DRIVE: {
                                            distance: leg.distance,
                                            duration: leg.duration,
                                            polyline: leg.polyline
                                        }
                                    },
                                    selectedMode: 'DRIVE' as TravelMode,
                                    loadingModes: []
                                }));

                                setRouteData({
                                    polyline: basicRouteData.polyline,
                                    legs: enhancedLegs as any,
                                    totalDistance: basicRouteData.totalDistance,
                                    totalDuration: basicRouteData.totalDuration,
                                    travelMode: 'DRIVE'
                                });

                                // Update route cache for active tab
                                const activitiesHash = hashActivities(dayData.activities);
                                routeCache.current[dayTab] = {
                                    activitiesHash,
                                    routeData: {
                                        polyline: basicRouteData.polyline,
                                        legs: enhancedLegs as any,
                                        totalDistance: basicRouteData.totalDistance,
                                        totalDuration: basicRouteData.totalDuration,
                                        travelMode: 'DRIVE'
                                    }
                                };

                                console.log('[syncNewOperations] ✅ Route data updated for active tab', dayTab);
                            }
                        } catch (error) {
                            console.error('[syncNewOperations] ❌ Error recalculating route for day', dayNumber, ':', error);
                        }
                    } else if (dayData && dayData.activities && dayData.activities.length <= 1) {
                        // Clear polyline if day has 0 or 1 activities (no route needed)
                        console.log('[syncNewOperations] Clearing polyline for day', dayNumber, '- only', dayData.activities.length, 'activity');
                        setDayPolyline(dayNumber, '');

                        // Clear route data if this is the active tab
                        if (activeTab === dayTab) {
                            setRouteData({
                                polyline: [],
                                legs: [],
                                totalDistance: 0,
                                totalDuration: '',
                                travelMode: 'DRIVE'
                            });
                        }
                    }
                }
            }

            const syncDuration = Date.now() - syncStartTime;
            console.log('[syncNewOperations] ✅ Sync complete in', syncDuration, 'ms');

        } catch (error) {
            console.error('[syncNewOperations] ❌ Sync failed:', error);
        } finally {
            isSyncingOperationsRef.current = false;

            // If a sync was requested while we were processing, trigger it now
            if (pendingSyncRef.current) {
                console.log('[syncNewOperations] Pending sync detected - triggering now');
                // Use setTimeout to avoid recursion and let the call stack clear
                setTimeout(() => {
                    syncNewOperations();
                }, 0);
            }
        }
    }, [tripId, currentUserID, activities, dayActivities, updateActivities, setLegTravelMode]);

    // Function to add activities back to the trip saved places
    const addActivitiesToWishlist = (newActivities: Activity[], prependToTop: boolean = false) => {
        // Combine activities - prepend to top if transferring from days, append to end if adding new
        const combinedActivities = prependToTop
            ? [...newActivities, ...(activities || [])]
            : [...(activities || []), ...newActivities];
        const deduplicatedActivities = combinedActivities.filter((activity, index, arr) => {
            // Use instanceId for deduplication (allows duplicate places with different instanceIds)
            if (!activity.instanceId) return true; // Keep activities without instanceId (backward compat)
            // Keep only the first occurrence of each instanceId
            return arr.findIndex(a => a.instanceId === activity.instanceId) === index;
        });

        updateActivities(deduplicatedActivities);

        // Track operation: add activities to wishlist
        const op = createOperation('add', 'wishlist', newActivities);
        queueSave(op);
    };

    // Handler for duplicating an activity
    const handleDuplicateActivity = useCallback((activity: Activity, targetDayNumber?: number) => {
        console.log('[trip-view_main] Duplicating activity:', activity.name);

        // Create duplicate with new instanceId but same place_id
        const duplicatedActivity = duplicateActivity(activity);

        if (targetDayNumber !== undefined && targetDayNumber !== null) {
            // Duplicate within a specific day – insert directly after the original
            const currentDayActivities = getDayActivities(targetDayNumber) || [];

            // Find original activity index (prefer instanceId, fall back to place_id + name)
            const originalIndex = currentDayActivities.findIndex(a => {
                if (activity.instanceId && a.instanceId) {
                    return a.instanceId === activity.instanceId;
                }
                if (activity.place_id && a.place_id) {
                    return a.place_id === activity.place_id && a.name === activity.name;
                }
                return false;
            });

            let newOrder: Activity[];
            if (originalIndex >= 0) {
                newOrder = [
                    ...currentDayActivities.slice(0, originalIndex + 1),
                    duplicatedActivity,
                    ...currentDayActivities.slice(originalIndex + 1),
                ];
            } else {
                // Fallback: append to end if we can't find the original
                newOrder = [...currentDayActivities, duplicatedActivity];
            }

            reorderDayActivities(targetDayNumber, newOrder);
            console.log(
                '[trip-view_main] Activity duplicated to day',
                targetDayNumber,
                'at index',
                originalIndex >= 0 ? originalIndex + 1 : newOrder.length - 1,
                'with instanceId:',
                duplicatedActivity.instanceId
            );

            // ✨ NEW: Track operation: add duplicated activity to day
            // Include insertAfter to preserve position (insert after original activity)
            const op = createOperation('add', 'day', {
                activities: [duplicatedActivity],
                insertAfter: activity.instanceId // Insert after this instanceId
            }, targetDayNumber);
            queueSave(op);
        } else {
            // Duplicate within wishlist – insert directly after the original
            updateActivities((prev: Activity[]) => {
                const prevActivities = Array.isArray(prev) ? prev : [];

                const originalIndex = prevActivities.findIndex(a => {
                    if (activity.instanceId && a.instanceId) {
                        return a.instanceId === activity.instanceId;
                    }
                    if (activity.place_id && a.place_id) {
                        return a.place_id === activity.place_id && a.name === activity.name;
                    }
                    return false;
                });

                const nextActivities = [...prevActivities];
                if (originalIndex >= 0) {
                    nextActivities.splice(originalIndex + 1, 0, duplicatedActivity);
                } else {
                    // Fallback: append to end if original isn't found
                    nextActivities.push(duplicatedActivity);
                }

                return nextActivities;
            });
            console.log('[trip-view_main] Activity duplicated in wishlist with instanceId:', duplicatedActivity.instanceId);

            // ✨ NEW: Track operation: add duplicated activity to wishlist
            // Include insertAfter to preserve position (insert after original activity)
            const op = createOperation('add', 'wishlist', {
                activities: [duplicatedActivity],
                insertAfter: activity.instanceId // Insert after this instanceId
            });
            queueSave(op);
        }
    }, [getDayActivities, reorderDayActivities, updateActivities, createOperation, queueSave]);

    // Handler for deleting a single activity
    const handleDeleteActivity = useCallback((activity: Activity, targetDayNumber?: number) => {
        console.log('[trip-view_main] Deleting activity:', activity.name);

        // Track saved place deletions to prevent re-addition from SavedPlacesStorage
        if (activity.savedPlaceId) {
            console.log('[trip-view_main] Marking savedPlaceId as deleted:', activity.savedPlaceId);
            addToDeletedSavedPlaces(activity.savedPlaceId);
        }

        if (targetDayNumber !== undefined && targetDayNumber !== null) {
            // Delete from a specific day
            const currentDayActivities = getDayActivities(targetDayNumber) || [];

            // Filter out the activity (prefer instanceId, fall back to place_id + name)
            const newOrder = currentDayActivities.filter(a => {
                if (activity.instanceId && a.instanceId) {
                    return a.instanceId !== activity.instanceId;
                }
                if (activity.place_id && a.place_id) {
                    return !(a.place_id === activity.place_id && a.name === activity.name);
                }
                return true;
            });

            reorderDayActivities(targetDayNumber, newOrder);
            console.log('[trip-view_main] Activity deleted from day', targetDayNumber);

            // Track operation: remove from day
            const op = createOperation('remove', 'day', activity.instanceId, targetDayNumber);
            queueSave(op);
        } else {
            // Delete from wishlist
            updateActivities((prev: Activity[]) => {
                const prevActivities = Array.isArray(prev) ? prev : [];

                return prevActivities.filter(a => {
                    if (activity.instanceId && a.instanceId) {
                        return a.instanceId !== activity.instanceId;
                    }
                    if (activity.place_id && a.place_id) {
                        return !(a.place_id === activity.place_id && a.name === activity.name);
                    }
                    return true;
                });
            });
            console.log('[trip-view_main] Activity deleted from wishlist');

            // Track operation: remove from wishlist
            const op = createOperation('remove', 'wishlist', activity.instanceId);
            queueSave(op);
        }
    }, [getDayActivities, reorderDayActivities, updateActivities, createOperation, queueSave, addToDeletedSavedPlaces]);

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
        activities: getActivitiesForTab(activeTab), // Pass current tab's activities instead of just trip saved places
        activeTab,
        getSelectedActivities,
        transferActivitiesToDay,
        transferActivitiesToWishlist,
        clearSelection,
        getDayCount,
        onTabChange: handleTabChange, // Pass the tab change handler
        updateWishlistActivities: addActivitiesToWishlist, // Pass function to add activities back to trip saved places
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
            const dayNumber = parseInt(activeTab.replace('day', ''));
            const activitiesHash = hashActivities(currentTabActivities);

            // If there are fewer than 2 routable activities, clear any existing polyline for this day
            const validRoutableActivities = currentTabActivities.filter(
                (a: Activity) => a.lat != null && a.lng != null && a.place_id
            );
            if (validRoutableActivities.length < 2) {
                setDayPolyline(dayNumber, '');
                setRouteLoading(false);
                return;
            }

            const cached = routeCache.current[activeTab];
            if (cached && cached.activitiesHash === activitiesHash) {
                setRouteData(cached.routeData);
                setRouteLoading(false);
                // Store encoded polyline in context if available
                if (cached.routeData.polyline && cached.routeData.polyline.length > 1) {
                    const encoded = encodePolyline(cached.routeData.polyline);
                    setDayPolyline(dayNumber, encoded);
                }
                return;
            }

            // Get saved travel modes for this day (from context - restored from DynamoDB)
            const savedModesForDay = dayTravelModes[dayNumber] || {};
            console.log('[fetchRoute] Saved travel modes for day', dayNumber, ':', savedModesForDay);

            // Fetch initial route with DRIVE mode (default)
            const basicRouteData = await fetchRoutePolyline(currentTabActivities);

            // Transform legs into EnhancedRouteLeg structure with DRIVE data
            // Apply saved travel modes from context (DynamoDB) or operations ref
            const enhancedLegs: EnhancedRouteLeg[] = basicRouteData.legs.map((leg: any, index: number) => {
                // Priority: 1. Operations ref (instanceId-based, real-time sync)
                //           2. Context/DynamoDB (legIndex-based, backward compatible)
                //           3. Default to DRIVE
                const originActivity = currentTabActivities[index];
                const instanceId = originActivity?.instanceId;
                const operationsOverride = instanceId ? transportModeOverridesRef.current[`${dayNumber}_${instanceId}`] : null;
                const savedMode = savedModesForDay[index];
                const selectedMode = (operationsOverride || savedMode || 'DRIVE') as TravelMode;

                return {
                    modeData: {
                        DRIVE: {
                            distance: leg.distance,
                            duration: leg.duration,
                            polyline: leg.polyline
                        }
                    },
                    selectedMode,
                    loadingModes: []
                };
            });

            // If any legs have non-DRIVE saved modes, fetch those modes
            const legsNeedingFetch = enhancedLegs
                .map((leg, index) => ({ leg, index, mode: leg.selectedMode }))
                .filter(item => item.mode !== 'DRIVE');

            if (legsNeedingFetch.length > 0) {
                console.log('[fetchRoute] Fetching mode data for', legsNeedingFetch.length, 'legs with saved non-DRIVE modes');

                await Promise.all(legsNeedingFetch.map(async ({ index, mode }) => {
                    try {
                        const legActivities = [currentTabActivities[index], currentTabActivities[index + 1]];
                        if (!legActivities[0] || !legActivities[1]) return;

                        const result = await fetchRoutePolylineWithMode(legActivities, mode);
                        if (result.legs[0]) {
                            enhancedLegs[index].modeData[mode] = {
                                distance: result.legs[0].distance,
                                duration: result.legs[0].duration,
                                polyline: result.legs[0].polyline
                            };
                        }
                    } catch (error) {
                        console.error(`[fetchRoute] Error fetching ${mode} mode for leg ${index}:`, error);
                        // Fallback to DRIVE if fetch fails
                        enhancedLegs[index].selectedMode = 'DRIVE';
                    }
                }));
            }

            // Recalculate polyline based on selected modes (not just DRIVE)
            let calculatedPolyline: { latitude: number; longitude: number }[] = [];
            for (let i = 0; i < enhancedLegs.length; i++) {
                const leg = enhancedLegs[i];
                const modeData = leg.modeData[leg.selectedMode];
                if (modeData?.polyline) {
                    const legCoords = decodePolyline(modeData.polyline);
                    calculatedPolyline = [...calculatedPolyline, ...legCoords];
                }
            }

            const newRouteData: RouteData = {
                polyline: calculatedPolyline.length > 0 ? calculatedPolyline : basicRouteData.polyline,
                legs: enhancedLegs,
                totalDistance: basicRouteData.totalDistance,
                totalDuration: basicRouteData.totalDuration,
                travelMode: 'DRIVE'
            };

            setRouteData(newRouteData);
            // Update cache
            routeCache.current[activeTab] = {
                activitiesHash,
                routeData: newRouteData,
            };
            // Store encoded polyline in context if available
            if (newRouteData.polyline && newRouteData.polyline.length > 1) {
                const encoded = encodePolyline(newRouteData.polyline);
                setDayPolyline(dayNumber, encoded);
            } else {
                // If recalculation produced no usable polyline, clear any stale overview polyline
                setDayPolyline(dayNumber, '');
            }
            setRouteLoading(false);
        };
        fetchRoute();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activities, dayActivities, dayTravelModes]);

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

    // Prefetch routes for all days on trip load so overview map shows polylines
    useEffect(() => {
        if (overviewRoutesFetchedRef.current) return;

        const dayNumbers = Object.keys(dayActivities).map(Number).sort((a, b) => a - b);
        if (dayNumbers.length === 0) return;

        // Find days with 2+ routable activities but no existing polyline
        const daysNeedingRoutes = dayNumbers.filter(dayNum => {
            if (dayPolylines[dayNum]) return false;
            const acts = getDayActivities(dayNum);
            const validActs = acts.filter((a: Activity) => a.lat != null && a.lng != null && a.place_id);
            return validActs.length >= 2;
        });

        if (daysNeedingRoutes.length === 0) {
            overviewRoutesFetchedRef.current = true;
            return;
        }

        overviewRoutesFetchedRef.current = true;

        const fetchAllRoutes = async () => {
            const results = await Promise.allSettled(
                daysNeedingRoutes.map(async (dayNum) => {
                    const acts = getDayActivities(dayNum);
                    const routeData = await fetchRoutePolyline(acts);
                    if (routeData.polyline && routeData.polyline.length > 1) {
                        const encoded = encodePolyline(routeData.polyline);
                        setDayPolyline(dayNum, encoded);
                    }
                })
            );
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`[Overview] Failed to prefetch route for day ${daysNeedingRoutes[index]}:`, result.reason);
                }
            });
        };

        fetchAllRoutes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dayActivities, dayPolylines]);

    // Get all available days as an array, and add 'wishlist' (trip saved places) as the last option
    const dayCount = getDayCount();

    // Prepare tab order: trip saved places first, then all days
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
            // 3. Use the optimized activities array directly.
            //    IMPORTANT: This preserves duplicate stops of the same place
            //    (each with its own instanceId), avoiding key collisions.
            let reorderedFull = reordered;

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

            // ✨ NEW: Track operation: reorder after optimization
            const reorderTimestamp = Date.now();
            const op = createOperation('reorder', 'day', {
                reorderedIds: reorderedFull.map(a => a.instanceId),
                lastReordered: reorderTimestamp,
                optimized: true // Flag to indicate this was from route optimization
            }, dayNumber);
            queueSave(op);

            // 6. Call getRoute Lambda via GraphQL for the new order
            const basicRouteData = await fetchRoutePolyline(reorderedFull);

            // Transform legs into EnhancedRouteLeg structure with DRIVE data only
            const enhancedLegs: EnhancedRouteLeg[] = basicRouteData.legs.map((leg: any) => ({
                modeData: {
                    DRIVE: {
                        distance: leg.distance,
                        duration: leg.duration,
                        polyline: leg.polyline
                    }
                },
                selectedMode: 'DRIVE' as TravelMode,
                loadingModes: []
            }));

            const newRouteData: RouteData = {
                polyline: basicRouteData.polyline,
                legs: enhancedLegs as any,
                totalDistance: basicRouteData.totalDistance,
                totalDuration: basicRouteData.totalDuration,
                travelMode: 'DRIVE'
            };

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
        // The new day number IS the new day count (e.g., if we had 3 days, newDayNumber is 4)
        const newDayCount = newDayNumber;
        setTripLength(newDayCount);

        // Immediately update the ref for tripLength
        latestTripDataRef.current.tripLength = newDayCount;

        // Update endDate to reflect the new trip length
        let newEndDate = endDate;
        if (startDate) {
            const start = new Date(startDate);
            const end = new Date(start);
            end.setDate(start.getDate() + (newDayCount - 1));
            newEndDate = end.toISOString();
            setEndDate(newEndDate);

            // Immediately update the ref to ensure saveTrip uses the latest value
            latestTripDataRef.current.endDate = newEndDate;
        }

        // Switch to the newly created day immediately
        setActiveTab(`day${newDayNumber}`);
        // Trigger auto-scroll to the new day
        setShouldScrollToActive(true);

        // ✨ NEW: Track operations and save trip (non-blocking, happens after UI update)
        setTimeout(async () => {
            // Track add day operation
            const addDayOp = createOperation('add', 'day', {
                action: 'addDay'
            }, newDayNumber);
            queueSave(addDayOp);

            // Save the full trip to persist the new end date
            await saveTrip();
        }, 0);
    };

    const handleReorderDays = (fromDay: number, toDay: number) => {
        if (fromDay === toDay) return;

        // Get the activities from both days
        const fromDayActivities = getDayActivities(fromDay) || [];
        const toDayActivities = getDayActivities(toDay) || [];

        // Swap the activities
        setDayActivities((prev: any) => {
            const newDayActivities = { ...prev };

            // Swap the activities between the two days
            if (newDayActivities[fromDay]) {
                newDayActivities[fromDay] = {
                    ...newDayActivities[fromDay],
                    activities: toDayActivities
                };
            }
            if (newDayActivities[toDay]) {
                newDayActivities[toDay] = {
                    ...newDayActivities[toDay],
                    activities: fromDayActivities
                };
            }

            return newDayActivities;
        });

        // Also swap polylines if they exist
        setDayPolylinesDeleteDay((prev: any) => {
            const newPolylines = { ...prev };
            const fromPolyline = prev[fromDay];
            const toPolyline = prev[toDay];

            if (fromPolyline) newPolylines[toDay] = fromPolyline;
            if (toPolyline) newPolylines[fromDay] = toPolyline;

            return newPolylines;
        });

        // Queue save operation (non-blocking)
        setTimeout(() => {
            const op = createOperation('modify', 'day', {
                action: 'reorderDays',
                fromDay,
                toDay
            });
            queueSave(op);
        }, 0);
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
            // Calculate day count BEFORE deletion (state hasn't updated yet)
            const dayCountBeforeDeletion = Object.keys(dayActivities).length;

            // Delete the day and get its activities to move back to wishlist
            const deletedDayActivities = deleteDayAndRenumber(dayToDelete);

            // Add deleted day activities back to wishlist at the top (with deduplication)
            // Exclude hotels/lodging from being added back to wishlist
            if (deletedDayActivities.length > 0) {
                // Filter out hotels/lodging - check all possible lodging indicators
                const nonLodgingActivities = deletedDayActivities.filter(
                    activity => {
                        // Check isLodging flag
                        if (activity.isLodging === true) return false;

                        // Check primaryType
                        if (activity.primaryType === 'lodging') return false;

                        // Check types array for lodging-related types
                        if (activity.types && Array.isArray(activity.types)) {
                            const hasLodgingType = activity.types.some(type =>
                                type && (
                                    type.toLowerCase().includes('lodging') ||
                                    type.toLowerCase().includes('hotel') ||
                                    type.toLowerCase().includes('hostel') ||
                                    type.toLowerCase().includes('accommodation') ||
                                    type.toLowerCase().includes('campground') ||
                                    type.toLowerCase().includes('rv_park')
                                )
                            );
                            if (hasLodgingType) return false;
                        }

                        return true;
                    }
                );

                // Prepend to top of wishlist
                const combinedActivities = [...nonLodgingActivities, ...(activities || [])];

                // Remove duplicates based on instanceId
                const deduplicatedActivities = combinedActivities.filter((activity, index, arr) => {
                    if (!activity.instanceId) return true; // Keep activities without instanceId (backward compat)
                    // Keep only the first occurrence of each instanceId
                    return arr.findIndex(a => a.instanceId === activity.instanceId) === index;
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
            const remainingDayCount = dayCountBeforeDeletion - 1; // Count after deletion
            // Update tripLength to reflect the new day count
            setTripLength(remainingDayCount);

            // Immediately update the ref for tripLength
            latestTripDataRef.current.tripLength = remainingDayCount;

            // Update dates to reflect the new trip length
            let newStartDate = startDate;
            let newEndDate = endDate;
            if (startDate && remainingDayCount > 0) {
                if (dayToDelete === 1) {
                    // Deleting day 1: advance startDate by 1, keep endDate
                    const start = new Date(startDate);
                    start.setDate(start.getDate() + 1);
                    newStartDate = start.toISOString();
                    setStartDate(newStartDate);
                    latestTripDataRef.current.startDate = newStartDate;
                } else {
                    // Deleting any other day: keep startDate, move endDate back by 1
                    const end = new Date(endDate!);
                    end.setDate(end.getDate() - 1);
                    newEndDate = end.toISOString();
                    setEndDate(newEndDate);
                    latestTripDataRef.current.endDate = newEndDate;
                }
            }

            if (remainingDayCount === 0) {
                // No days left, go to wishlist
                setActiveTab('wishlist');
            } else if (dayToDelete === 1) {
                // Deleting day 1: go to new day 1 (formerly day 2)
                setActiveTab('day1');
            } else {
                // Deleting any other day, go to the previous day
                setActiveTab(`day${dayToDelete - 1}`);
            }

            // ✨ Queue save operations and save trip (non-blocking)
            setTimeout(async () => {
                // Track operation: delete day
                const op = createOperation('remove', 'day', {
                    action: 'deleteDay',
                    hadActivities: hasActivities
                }, dayToDelete);
                queueSave(op);

                // Track moving activities back to wishlist
                if (deletedDayActivities.length > 0) {
                    deletedDayActivities.forEach((activity: Activity, index: number) => {
                        const op = createOperation('move', 'wishlist', {
                            activity: activity,
                            fromLocation: dayToDelete,
                            toLocation: 'wishlist',
                            insertIndex: index
                        });
                        queueSave(op);
                    });
                }

                // Save the full trip to persist the new end date
                await saveTrip();
            }, 0);
        };

        // Only show confirmation dialog if the day has activities
        if (hasActivities) {
            Alert.alert(
                'Delete Day',
                `Are you sure you want to delete this day? All activities will be moved back to your saved places.`,
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

        // Track saved place deletions to prevent re-addition from SavedPlacesStorage
        const trip_saved_places_activities = getActivitiesForTab('wishlist');
        const allDayActivities: Activity[] = [];
        for (let i = 1; i <= getDayCount(); i++) {
            allDayActivities.push(...(getDayActivities(i) || []));
        }
        const allActivitiesInTrip = [...trip_saved_places_activities, ...allDayActivities];

        selectedActivities.forEach(instanceId => {
            // Find the actual activity object to check for savedPlaceId
            const activity = allActivitiesInTrip.find(a => a.instanceId === instanceId);
            if (activity?.savedPlaceId) {
                console.log('[trip-view_main] Bulk delete - marking savedPlaceId as deleted:', activity.savedPlaceId);
                addToDeletedSavedPlaces(activity.savedPlaceId);
            }

            // Determine if activity is in trip saved places or a day
            const inWishlist = trip_saved_places_activities.some(a => a.instanceId === instanceId);

            if (inWishlist) {
                const op = createOperation('remove', 'wishlist', instanceId);
                queueSave(op);
            } else {
                // Activity is in a day - find which day
                if (activeTab.startsWith('day')) {
                    const dayNumber = parseInt(activeTab.replace('day', ''));
                    const op = createOperation('remove', 'day', instanceId, dayNumber);
                    queueSave(op);
                }
            }
        });

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
            const reorderTimestamp = Date.now();

            // Add timestamp to activities for conflict resolution
            const orderedActivities = newOrder.map(a => ({
                ...a,
                lastReordered: reorderTimestamp
            }));

            // Update the activities for this day using the existing reorderDayActivities function
            reorderDayActivities(dayNumber, orderedActivities);

            // Track operation: reorder (store IDs only, not full activities)
            const op = createOperation('reorder', 'day', {
                reorderedIds: orderedActivities.map(a => a.instanceId),
                lastReordered: reorderTimestamp
            }, dayNumber);
            queueSave(op);

            // Clear the route cache for this day to trigger route recalculation
            const dayTab = `day${dayNumber}`;
            delete routeCache.current[dayTab];

            // If this is the currently active tab, trigger route recalculation
            if (activeTab === dayTab) {
                setRouteLoading(true);
                const basicRouteData = await fetchRoutePolyline(newOrder);

                // Transform legs into EnhancedRouteLeg structure with DRIVE data only
                const enhancedLegs: EnhancedRouteLeg[] = basicRouteData.legs.map((leg: any) => ({
                    modeData: {
                        DRIVE: {
                            distance: leg.distance,
                            duration: leg.duration,
                            polyline: leg.polyline
                        }
                    },
                    selectedMode: 'DRIVE' as TravelMode,
                    loadingModes: []
                }));

                const newRouteData: RouteData = {
                    polyline: basicRouteData.polyline,
                    legs: enhancedLegs as any,
                    totalDistance: basicRouteData.totalDistance,
                    totalDuration: basicRouteData.totalDuration,
                    travelMode: 'DRIVE'
                };

                setRouteData(newRouteData);

                // Update the route cache for this day
                const activitiesHash = hashActivities(orderedActivities);
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

    // Helper to parse duration string like "15m 30s" to seconds
    const parseDuration = (durationStr: string): number => {
        const parts = durationStr.trim().split(' ');
        let totalSeconds = 0;
        parts.forEach(part => {
            if (part.endsWith('h')) {
                totalSeconds += parseInt(part) * 3600;
            } else if (part.endsWith('m')) {
                totalSeconds += parseInt(part) * 60;
            } else if (part.endsWith('s')) {
                totalSeconds += parseInt(part);
            }
        });
        return totalSeconds;
    };

    // Helper to format seconds to "Xm" or "Xh Ym" format
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }
        return `${minutes}m`;
    };

    // Handler for opening transportation settings modal
    const handleOpenSettings = async (legIndex: number) => {
        if (!activeTab.startsWith('day')) return;

        const currentDayNumber = parseInt(activeTab.replace('day', ''));
        const dayActivities = getActivitiesForTab(activeTab);

        if (legIndex < 0 || legIndex >= dayActivities.length - 1) return;

        // Store the origin and destination activities in state
        const origin = dayActivities[legIndex];
        const destination = dayActivities[legIndex + 1];

        console.log('[handleOpenSettings] Setting modal activities:', {
            legIndex,
            hasOrigin: !!origin,
            hasDestination: !!destination,
            originName: origin?.name,
            destinationName: destination?.name,
            originLat: origin?.lat,
            originLng: origin?.lng,
            destLat: destination?.lat,
            destLng: destination?.lng,
        });

        setModalOriginActivity(origin);
        setModalDestinationActivity(destination);
        setSelectedLegIndex(legIndex);
        setSettingsModalVisible(true);

        // Get the current leg
        const currentLeg = routeData.legs[legIndex] as any as EnhancedRouteLeg | undefined;

        // Lazy load missing modes
        const missingModes: TravelMode[] = [];
        if (!currentLeg?.modeData?.WALK) missingModes.push('WALK');
        if (!currentLeg?.modeData?.DRIVE) missingModes.push('DRIVE');
        if (!currentLeg?.modeData?.TRANSIT) missingModes.push('TRANSIT');

        if (missingModes.length > 0 && currentLeg) {
            // Mark modes as loading
            const updatedLegs = [...routeData.legs];
            updatedLegs[legIndex] = {
                ...currentLeg,
                loadingModes: [...(currentLeg.loadingModes || []), ...missingModes]
            } as any;
            setRouteData(prev => ({ ...prev, legs: updatedLegs as any }));

            // Fetch missing modes in parallel
            const legActivities = [dayActivities[legIndex], dayActivities[legIndex + 1]];
            const fetchPromises = missingModes.map(async (mode) => {
                try {
                    const result = await fetchRoutePolylineWithMode(legActivities, mode);
                    return { mode, data: result.legs[0] };
                } catch (error) {
                    console.error(`Error fetching ${mode} mode:`, error);
                    return { mode, data: null };
                }
            });

            const results = await Promise.all(fetchPromises);

            // Update leg with fetched data
            const updatedLeg = { ...currentLeg };
            results.forEach(({ mode, data }) => {
                if (data) {
                    updatedLeg.modeData[mode] = data;
                }
            });
            updatedLeg.loadingModes = [];

            const finalLegs = [...routeData.legs];
            finalLegs[legIndex] = updatedLeg as any;
            setRouteData(prev => ({ ...prev, legs: finalLegs as any }));
        }
    };

    // Handler for selecting a transportation mode
    const handleSelectMode = async (mode: TravelMode) => {
        if (!activeTab.startsWith('day') || selectedLegIndex === null) return;

        const dayActivities = getActivitiesForTab(activeTab);
        const currentDayNumber = parseInt(activeTab.replace('day', ''));

        // Get the origin activity for this leg (used for operation tracking)
        const originActivity = dayActivities[selectedLegIndex];
        const originInstanceId = originActivity?.instanceId;

        // Update the selected mode for this leg
        const updatedLegs = [...routeData.legs];
        const currentLeg = updatedLegs[selectedLegIndex] as any as EnhancedRouteLeg;
        updatedLegs[selectedLegIndex] = {
            ...currentLeg,
            selectedMode: mode
        } as any;

        // Recalculate polyline based on all selected modes
        let newPolylineCoords: { latitude: number; longitude: number }[] = [];
        for (let i = 0; i < updatedLegs.length; i++) {
            const leg = updatedLegs[i] as any as EnhancedRouteLeg;
            const modeData = leg.modeData[leg.selectedMode];
            if (modeData?.polyline) {
                const legCoords = decodePolyline(modeData.polyline);
                newPolylineCoords = [...newPolylineCoords, ...legCoords];
            }
        }

        // Calculate new total distance and duration
        let totalDistance = 0;
        let totalDurationSeconds = 0;
        updatedLegs.forEach((leg) => {
            const enhancedLeg = leg as any as EnhancedRouteLeg;
            const modeData = enhancedLeg.modeData[enhancedLeg.selectedMode];
            if (modeData) {
                totalDistance += modeData.distance || 0;
                totalDurationSeconds += parseDuration(modeData.duration || '0m');
            }
        });

        // Update route data with new polyline and totals
        const newRouteData = {
            ...routeData,
            polyline: newPolylineCoords,
            legs: updatedLegs,
            totalDistance,
            totalDuration: formatDuration(totalDurationSeconds)
        };

        setRouteData(newRouteData);

        // Update cache
        const activitiesHash = hashActivities(dayActivities);
        routeCache.current[activeTab] = {
            activitiesHash,
            routeData: newRouteData
        };

        // Store encoded polyline in context
        if (newPolylineCoords.length > 1) {
            const encoded = encodePolyline(newPolylineCoords);
            setDayPolyline(currentDayNumber, encoded);
        }

        // ✨ Track operation: update_transport_mode for real-time sync
        if (originInstanceId) {
            // Update local transport mode overrides ref
            const legKey = `${currentDayNumber}_${originInstanceId}`;
            transportModeOverridesRef.current[legKey] = mode;

            const op = createOperation('update_transport_mode', 'day', {
                originInstanceId,
                mode,
                lastModified: Date.now(),
            }, currentDayNumber);
            queueSave(op);
            console.log('[handleSelectMode] Recorded update_transport_mode operation:', {
                dayNumber: currentDayNumber,
                originInstanceId,
                mode,
            });
        }

        // ✨ Persist to context for DynamoDB snapshot save (backward compatible)
        // This ensures the mode is saved with the trip and restored on reload
        setLegTravelMode(currentDayNumber, selectedLegIndex, mode);
        console.log('[handleSelectMode] Persisted to context for DynamoDB save:', {
            dayNumber: currentDayNumber,
            legIndex: selectedLegIndex,
            mode,
        });
    };

    // Handler for activity description card selection
    const handleActivityDescriptionCardSelect = (activity: Activity) => {
        setSelectedActivityForDetail(activity);
        setShowActivityDetail(true);
        // Set selected marker when opening detail view
        if (activity.place_id) {
            setSelectedMarker(activity.place_id);
        }
        // Set height to DEFAULT_HEIGHT when opening activity detail
        changeHeightState(1); // 1 = DEFAULT_HEIGHT
    };

    // Handler for activity detail scroll state change
    const handleActivityDetailScrollStateChange = (isScrolledDown: boolean) => {
        if (isScrolledDown) {
            // When scrolled down, expand to MAX_HEIGHT
            changeHeightState(2); // 2 = MAX_HEIGHT
        } else {
            // When scrolled back to top, return to DEFAULT_HEIGHT
            changeHeightState(1); // 1 = DEFAULT_HEIGHT
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
            
            // Delay setting to true to ensure component is mounted
            setTimeout(() => {
                setShouldRestoreScrollPositions(prev => ({
                    ...prev,
                    [currentDayNumber]: true
                }));
            }, 100);

            // Reset the flag after restoration
            setTimeout(() => {
                setShouldRestoreScrollPositions(prev => ({
                    ...prev,
                    [currentDayNumber]: false
                }));
            }, 300);
        } else if (activeTab === 'wishlist') {
            // Restore wishlist scroll position
            setTimeout(() => {
                wishlistScrollViewRef.current?.scrollTo({ 
                    y: wishlistScrollPosRef.current, 
                    animated: false 
                });
            }, 100);
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

    // Helper function to add or subtract hours from a time string (HH:mm format)
    const addHoursToTime = (timeStr: string, hours: number): string => {
        const [hoursStr, minutes] = timeStr.split(':');
        const totalMinutes = parseInt(hoursStr) * 60 + parseInt(minutes) + (hours * 60);

        // Handle wraparound (negative or > 24 hours)
        let newTotalMinutes = totalMinutes;
        if (newTotalMinutes < 0) {
            newTotalMinutes += 24 * 60; // Add 24 hours if negative
        } else if (newTotalMinutes >= 24 * 60) {
            newTotalMinutes -= 24 * 60; // Subtract 24 hours if over
        }

        const newHours = Math.floor(newTotalMinutes / 60);
        const newMinutes = newTotalMinutes % 60;

        return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    };

    // Handler for adding lodging to trip across multiple days
    const handleAddLodgingToTrip = (lodgingData: any) => {
        const { hotel, checkInDate, checkOutDate, stayLength, checkInTime, checkOutTime } = lodgingData;

        console.log('[trip-view_main] Adding lodging to trip:', lodgingData);

        const dayCount = getDayCount();

        if (dayCount === 0) {
            console.log('[trip-view_main] No days exist in trip yet. Cannot add lodging.');
            Alert.alert('No Days Available', 'Please create days for your trip before adding lodging.');
            return;
        }

        if (!startDate) {
            console.log('[trip-view_main] No trip start date found. Cannot calculate day numbers.');
            Alert.alert('Missing Trip Dates', 'Please set your trip start and end dates before adding lodging.');
            return;
        }

        // Calculate which day numbers correspond to check-in and check-out dates
        const tripStartDate = new Date(startDate);
        tripStartDate.setHours(0, 0, 0, 0); // Normalize to midnight

        const checkInDateTime = new Date(checkInDate);
        checkInDateTime.setHours(0, 0, 0, 0);

        const checkOutDateTime = new Date(checkOutDate);
        checkOutDateTime.setHours(0, 0, 0, 0);

        // Calculate day numbers (day 1 = trip start date)
        const checkInDayNumber = Math.floor((checkInDateTime.getTime() - tripStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const checkOutDayNumber = Math.floor((checkOutDateTime.getTime() - tripStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        console.log('[trip-view_main] Check-in day:', checkInDayNumber, 'Check-out day:', checkOutDayNumber);

        // Validate day numbers
        if (checkInDayNumber < 1 || checkInDayNumber > dayCount || checkOutDayNumber < 1 || checkOutDayNumber > dayCount) {
            console.log('[trip-view_main] Invalid day numbers calculated.');
            Alert.alert('Invalid Dates', 'The selected check-in/check-out dates are outside your trip dates.');
            return;
        }

        // Helper to check if activity is lodging
        const isLodgingActivity = (a: Activity) => a?.isLodging === true || a?.primaryType === 'lodging';

        // Find overlapping lodging in the target day range
        let overlappingPlaceId: string | null = null;
        let overlappingName: string | null = null;
        let overlapMinDay = Infinity;
        let overlapMaxDay = -Infinity;

        for (let dayNumber = checkInDayNumber; dayNumber <= checkOutDayNumber; dayNumber++) {
            const currentActivities = getDayActivities(dayNumber) || [];
            const lodging = currentActivities.find((a) => isLodgingActivity(a));
            if (lodging?.place_id) {
                overlappingPlaceId = lodging.place_id;
                overlappingName = lodging.name || 'Hotel';
                break;
            }
        }

        if (overlappingPlaceId) {
            // Find full day range of the existing stay
            for (let dayNumber = checkInDayNumber; dayNumber <= checkOutDayNumber; dayNumber++) {
                const currentActivities = getDayActivities(dayNumber) || [];
                const hasMatch = currentActivities.some(
                    (a) => isLodgingActivity(a) && a.place_id === overlappingPlaceId
                );
                if (hasMatch) {
                    overlapMinDay = Math.min(overlapMinDay, dayNumber);
                    overlapMaxDay = Math.max(overlapMaxDay, dayNumber);
                }
            }

            const startDayDate = new Date(tripStartDate);
            startDayDate.setDate(startDayDate.getDate() + (overlapMinDay - 1));
            const endDayDate = new Date(tripStartDate);
            endDayDate.setDate(endDayDate.getDate() + (overlapMaxDay - 1));
            const formatForAlert = (date: Date) =>
                date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const dateRangeStr = `${formatForAlert(startDayDate)} – ${formatForAlert(endDayDate)}`;

            //Alert to confirm if the user would like to override their hotel with a new one. Maybe modal in the future
            //(cont.) for customization?
            Alert.alert(
                'Replace Hotel?',
                `You are replacing your previous hotel at "${overlappingName}" from ${dateRangeStr}. Continue?`,
                [
                    { text: 'No', style: 'cancel' },
                    {
                        text: 'Yes',
                        onPress: () => {
                            const toRemove = findRelatedLodgingInstancesWithDays(
                                overlappingPlaceId!,
                                dayActivities
                            ).filter(({ dayNumber }) =>
                                dayNumber >= checkInDayNumber &&
                                dayNumber <= checkOutDayNumber
                            ); //removing ONLY the days selected, not all instances of the old hotel
                            toRemove.forEach(({ instanceId, dayNumber }) => {
                                const op = createOperation('remove', 'day', instanceId, dayNumber);
                                queueSave(op);
                            });
                            doAddLodgingToDays(
                                hotel,
                                checkInDayNumber,
                                checkOutDayNumber,
                                checkInTime,
                                checkOutTime,
                                overlappingPlaceId!
                            );
                        },
                    },
                ]
            );
            return;
        }

        doAddLodgingToDays(
            hotel,
            checkInDayNumber,
            checkOutDayNumber,
            checkInTime,
            checkOutTime,
            null
        );

        function doAddLodgingToDays(
            hotelActivity: any,
            checkInDay: number,
            checkOutDay: number,
            checkInTimeStr: string,
            checkOutTimeStr: string,
            excludePlaceId: string | null
        ) {
            for (let dayNumber = checkInDay; dayNumber <= checkOutDay; dayNumber++) {
                let currentActivities = getDayActivities(dayNumber) || [];
                //Checking to see if activity is lodging related
                const lodgingActivities = currentActivities.filter(
                    (a) => isLodgingActivity(a) && a.place_id === excludePlaceId
                );
                const nonLodgingActivities = currentActivities.filter(
                    (a) => !isLodgingActivity(a)
                );

                const oldFirstLodging = lodgingActivities[0];
                const oldLastLodging = lodgingActivities[lodgingActivities.length - 1];
                const activitiesToAdd: Activity[] = [];

                let preservedOldLodging: Activity[] = [];
                if (excludePlaceId) {
                    if (excludePlaceId && dayNumber === checkInDay && dayNumber !== 1 && oldFirstLodging) {
                        preservedOldLodging.push(oldFirstLodging);
                    }
                    if (dayNumber === checkOutDay && oldLastLodging) {
                        preservedOldLodging.push(oldLastLodging);
                    }
                }
                //if not the first day, and old hotel remains at the borders of override, but are replaced throughout by new hotel

                if (dayNumber === checkInDay && dayNumber === checkOutDay) {
                    // Same-day stay, or last day
                    activitiesToAdd.push({
                        ...hotelActivity,
                        instanceId: duplicateActivity(hotelActivity).instanceId,
                        notes: 'Check-in / Check-out',
                        startTime: addHoursToTime(checkInTimeStr, -1),
                        endTime: checkOutTimeStr,
                    });
                }
                else if (dayNumber === checkInDay) {
                    // First day: ONLY last stop
                    activitiesToAdd.push({
                        ...hotelActivity,
                        instanceId: duplicateActivity(hotelActivity).instanceId,
                        notes: 'Check-in',
                        startTime: addHoursToTime(checkInTimeStr, -1),
                        endTime: addHoursToTime(checkInTimeStr, 1),
                    });
                }
                else if (dayNumber === checkOutDay) {
                    // Last day: ONLY first stop
                    activitiesToAdd.push({
                        ...hotelActivity,
                        instanceId: duplicateActivity(hotelActivity).instanceId,
                        notes: 'Check-out',
                        startTime: addHoursToTime(checkOutTimeStr, -1),
                        endTime: checkOutTimeStr,
                    });
                }
                else {
                    // Middle days: first + last
                    activitiesToAdd.push(
                        {
                            ...hotelActivity,
                            instanceId: duplicateActivity(hotelActivity).instanceId,
                        },
                        {
                            ...hotelActivity,
                            instanceId: duplicateActivity(hotelActivity).instanceId,
                        }
                    );
                }

                let newOrder: Activity[] = [];

                if (dayNumber === checkInDay) {
                    newOrder = [
                        ...preservedOldLodging,
                        ...nonLodgingActivities,
                        ...activitiesToAdd, // always exactly 1 here
                    ];
                }
                else if (dayNumber === checkOutDay) {
                    newOrder = [
                        ...activitiesToAdd, // always exactly 1 here
                        ...nonLodgingActivities,
                        ...preservedOldLodging,
                    ];
                }
                else {
                    newOrder = [
                        activitiesToAdd[0],
                        ...nonLodgingActivities,
                        activitiesToAdd[1],
                    ];
                }


                const reorderTimestamp = Date.now();
                const orderedActivities = newOrder.map((a) => ({
                    ...a,
                    lastReordered: reorderTimestamp,
                }));
                reorderDayActivities(dayNumber, orderedActivities);

                const addOp = createOperation('add', 'day', activitiesToAdd, dayNumber);
                queueSave(addOp);

                const reorderOp = createOperation('reorder', 'day', {
                    reorderedIds: orderedActivities.map((a) => a.instanceId),
                    lastReordered: reorderTimestamp,
                }, dayNumber);
                queueSave(reorderOp);
            }

            console.log('[trip-view_main] Successfully added lodging to days', checkInDay, 'through', checkOutDay);
        }
    };

    // Handler for saving search results (new direct flow)
    const handleSaveSearchResults = (selectedActivities: Activity[], wishlistActivityIds?: string[], lodgingData?: any, flightData?: FlightReservation) => {
        // Handle flight data if provided
        if (flightData) {
            // TODO: Implement flight handling
            console.log('[trip-view_main] Flight data received but not yet implemented:', flightData);
            return;
        }

        // Handle lodging data if provided
        if (lodgingData) {
            handleAddLodgingToTrip(lodgingData);
            return;
        }

        if (selectedActivities.length === 0) {
            return;
        }

        // If wishlistActivityIds are provided, we're moving activities from wishlist to current tab
        if (wishlistActivityIds && wishlistActivityIds.length > 0) {
            // Remove from wishlist
            removeActivities(wishlistActivityIds);

            // ✨ NEW: Track removal from wishlist
            wishlistActivityIds.forEach(instanceId => {
                const op = createOperation('remove', 'wishlist', instanceId);
                queueSave(op);
            });

            // Add to the current tab
            if (activeTab === 'wishlist') {
                // Already on wishlist, no need to move
                return;
            } else if (activeTab.startsWith('day')) {
                // Add to the specific day
                const dayNumber = parseInt(activeTab.replace('day', ''));
                selectedActivities.forEach(activity => {
                    addActivityToDay(activity, dayNumber);
                });

                // ✨ NEW: Track add to day
                const op = createOperation('add', 'day', selectedActivities, dayNumber);
                queueSave(op);
            }
        } else {
            // Normal flow: adding new activities from search
            if (activeTab === 'wishlist') {
                // Add to wishlist
                updateActivities([...(activities || []), ...selectedActivities]);

                // ✨ NEW: Track add to wishlist
                const op = createOperation('add', 'wishlist', selectedActivities);
                queueSave(op);
            } else if (activeTab.startsWith('day')) {
                // Add to the specific day
                const dayNumber = parseInt(activeTab.replace('day', ''));
                selectedActivities.forEach(activity => {
                    addActivityToDay(activity, dayNumber);
                });

                // ✨ NEW: Track add to day
                const op = createOperation('add', 'day', selectedActivities, dayNumber);
                queueSave(op);
            } else {
                // Fallback to wishlist
                updateActivities([...(activities || []), ...selectedActivities]);

                // ✨ NEW: Track add to wishlist
                const op = createOperation('add', 'wishlist', selectedActivities);
                queueSave(op);
            }
        }

        // Modal auto-closes in AutocompleteModal component
        setShowAutocomplete(false);
        setSearchQuery('');
    };

    // ===== CATEGORY FLOW HANDLERS =====

    // Debug log: city categories and UI conditions (REMOVED - causing excessive re-renders)
    // useEffect(() => {
    //     console.log('[trip-view_main] cityCategories updated:', Array.isArray(cityCategories) ? cityCategories.length : cityCategories);
    //     if (Array.isArray(cityCategories)) {
    //         console.log('[trip-view_main] cityCategories sample:', cityCategories[0]);
    //     }
    //     console.log('[trip-view_main] selectedCity:', selectedCity);
    // }, [cityCategories, selectedCity]);

    // Handler for category card press
    const handleCategoryPress = async (category: any) => {
        setSelectedCategory(category.category);
        setShowCategoryModal(true);

        // Check if we already have cached activities for this category in context
        if (categoryActivities[category.category] && categoryActivities[category.category].length > 0) {
            // Activities already exist in context, no need to fetch
            return;
        }

        // If not cached, fetch new activities
        setLoadingCategoryActivities(true);

        try {
            // Generate activities for this category (this updates context's categoryActivities)
            await generateActivitiesForCategory(category.category);
        } catch (error) {
            console.error('[trip-view_main] Error generating category activities:', error);
            // Alert.alert('Error', 'Failed to load activities. Please try again.');
            setShowCategoryModal(false);
        } finally {
            setLoadingCategoryActivities(false);
        }
    };

    // Handler for saving category activities
    const handleSaveCategoryActivities = (selectedActivities: Activity[], deselectedWishlistActivityIds: string[] = []) => {
        // Remove deselected wishlist activities
        if (deselectedWishlistActivityIds.length > 0) {
            removeActivities(deselectedWishlistActivityIds);

            // ✨ NEW: Track removal of deselected activities
            deselectedWishlistActivityIds.forEach(instanceId => {
                const op = createOperation('remove', 'wishlist', instanceId);
                queueSave(op);
            });
        }

        // Add newly selected activities
        // FIXED: Use addActivitiesToWishlist directly (which tracks operations)
        // instead of context's addToWishlist (which bypasses operation tracking)
        if (selectedActivities.length > 0) {
            addActivitiesToWishlist(selectedActivities);
        }

        setShowCategoryModal(false);
    };

    // Handler for generating more category activities
    const handleGenerateMoreCategoryActivities = async (categoryName: string) => {
        setLoadingMoreCategoryActivities(true);

        try {
            // Generate more activities for this category (updates context automatically)
            await generateActivitiesForCategory(categoryName);
        } catch (error: any) {
            // Check if this is a limit reached error
            if (error.message && error.message.includes('Activity generation limit reached')) {
                throw error; // Re-throw to let CategoryModal handle the alert
            } else {
                throw error; // Re-throw to let CategoryModal handle the alert
            }
        } finally {
            setLoadingMoreCategoryActivities(false);
        }
    };

    // Handler to reload trip with latest changes from remote
    const handleReloadTrip = async () => {
        try {
            // Set reloading flag to prevent autosave during reload
            isReloadingRef.current = true;

            // Get owner's userID from collaborators
            const owner = collaborators.find(c => c.role === 'owner');
            if (!owner) {
                isReloadingRef.current = false;
                return;
            }

            // Fetch latest trip data
            const updatedTrip = await retrieveTripFromCloud(owner.userID, tripId);

            if (updatedTrip) {
                // Restore trip data into context
                restoreTripFromObject(updatedTrip, currentUserID);

                // Note: No version tracking needed - using operation-based architecture

                console.log('[trip-view_main] Trip reloaded');
            }

            // Clear reloading flag after a delay to allow state to settle
            setTimeout(() => {
                isReloadingRef.current = false;
            }, 2000);
        } catch (error) {
            console.error('[trip-view_main] Error reloading trip:', error);
            isReloadingRef.current = false;
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

    // Helper to sanitize recent searches for GraphQL input
    const sanitizeRecentSearch = (recentSearch: any) => {
        const { __typename, ...rest } = recentSearch || {};
        return {
            place_id: rest.place_id,
            name: rest.name,
            address_info: rest.address_info,
            timestamp: rest.timestamp,
        };
    };

    // Serialize trip data for saving
    const saveTrip = async () => {
        // Check if save is already in progress using ref for immediate access
        if (isSavingRef.current) {
            console.log('[trip-view_main] Save already in progress, skipping duplicate save');
            return;
        }

        isSavingRef.current = true;
        setIsSaving(true);

        try {
            // Use latest values from ref to avoid stale closures
            const {
                activities: latestActivities,
                dayActivities: latestDayActivities,
                dayPolylines: latestDayPolylines,
                dayTravelModes: latestDayTravelModes,
                selectedCity: latestSelectedCity,
                tripPhotoReference: latestTripPhotoReference,
                createdAt: latestCreatedAt,
                recentSearches: latestRecentSearches,
                deletedSavedPlaceIds: latestDeletedSavedPlaceIds,
                startDate: latestStartDate,
                endDate: latestEndDate,
                tripTitle: latestTripTitle,
                tripLength: latestTripLength,
            } = latestTripDataRef.current;

            // Gather days and their activities (sanitize activities for GraphQL input)
            const days = Object.keys(latestDayActivities).map(dayNumber => ({
                dayNumber: Number(dayNumber),
                activities: latestDayActivities[dayNumber].activities.map(sanitizeActivity),
                encodedPolyline: latestDayPolylines[dayNumber] || null,
                travelModes: latestDayTravelModes[dayNumber] ? JSON.stringify(latestDayTravelModes[dayNumber]) : null,
            }));
            // Gather wishlist activities (not assigned to any day) and sanitize them
            const dayActivityInstanceIds = days.flatMap(day => day.activities.map(a => a.instanceId)).filter(Boolean);
            const wishlist = (latestActivities || [])
                .filter((activity) => !activity.instanceId || !dayActivityInstanceIds.includes(activity.instanceId))
                .map(sanitizeActivity);
            // Compose trip data object
            // Generate tripId if it doesn't exist (first time save)
            // Use tripIdRef for immediate access to avoid race conditions
            // IMPORTANT: Check context tripId first (may have been set from create_trip_1_city)
            let currentTripId = tripIdRef.current;
            if (!currentTripId) {
                // Only generate a new tripId if one doesn't exist in context
                currentTripId = generateTripId();
                console.log('[trip-view_main] Generated new tripId:', currentTripId);
                // Immediately update ref to prevent duplicate generation
                tripIdRef.current = currentTripId;
                // Also update context state
                setTripId(currentTripId);
            } else {
                console.log('[trip-view_main] Using existing tripId from context:', currentTripId);
            }

            // Preserve original createdAt for existing trips, generate only for new trips
            let tripCreatedAt = latestCreatedAt;
            if (!tripCreatedAt) {
                tripCreatedAt = new Date().toISOString();
                setCreatedAt(tripCreatedAt);
                console.log('[trip-view_main] Generated new createdAt:', tripCreatedAt);
            }

            // Sanitize cityCategories to only include allowed fields per GraphQL input
            const cleanCityCategories = Array.isArray(cityCategories)
                ? cityCategories.map((c: any) => ({
                    category: c?.category,
                    category_items: Array.isArray(c?.category_items) ? c.category_items : [],
                    ...(typeof c?.emoji === 'string' ? { emoji: c.emoji } : {})
                }))
                : null;

            // Sanitize recentSearches for GraphQL input
            const cleanRecentSearches = Array.isArray(latestRecentSearches)
                ? latestRecentSearches.map(sanitizeRecentSearch)
                : [];

            const tripData = {
                tripId: currentTripId,
                tripTitle: latestTripTitle || null, // Preserve custom trip title
                days,
                wishlist,
                tripLength: latestTripLength || days.length, // Use tripLength from state/ref, fallback to days.length
                selectedCity: latestSelectedCity,
                tripPhotoReference: Array.isArray(latestTripPhotoReference)
                    ? latestTripPhotoReference
                    : (latestTripPhotoReference ? [String(latestTripPhotoReference)] : []),
                createdAt: tripCreatedAt,
                startDate: latestStartDate || null,
                endDate: latestEndDate || null,
                cityCategories: cleanCityCategories || null, // Save city categories for restoration
                recentSearches: cleanRecentSearches,
                deletedSavedPlaceIds: Array.from(latestDeletedSavedPlaceIds), // Convert Set to Array for GraphQL
            };

            // Get current user information
            let currentUserID;
            let currentUserEmail;
            let currentUserName;
            let currentUsername;
            const currentUser = await Auth.currentAuthenticatedUser();
            // Use username (not sub) for consistency with collaborator storage
            currentUserID = currentUser.username;
            currentUserEmail = currentUser.attributes?.email || '';
            currentUserName = currentUser.attributes?.name || '';
            currentUsername = currentUser.attributes?.preferred_username || currentUser.username || currentUserEmail.split('@')[0];

            // Handle collaborators and determine the owner's userID
            let collaboratorsToSave;
            let ownerUserID; // This will be used as the partition key in DynamoDB

            // Check if this is a truly NEW trip (no tripId in DB AND no collaborators in context)
            // Note: tripId might exist in context if set from create_trip_1_city, but not saved to DB yet
            const isBrandNewTrip = !tripId && collaborators.length === 0;

            if (isBrandNewTrip) {
                // NEW TRIP (created directly in trip-view_main): Current user becomes owner
                ownerUserID = currentUserID;
                collaboratorsToSave = [{
                    email: currentUserEmail,
                    fullName: currentUserName,
                    username: currentUsername,
                    userID: currentUserID,
                    role: 'owner',
                    addedBy: currentUserName
                }];
                console.log('[trip-view_main] New trip - current user set as owner');
            } else if (collaborators.length > 0) {
                // EXISTING TRIP or TRIP WITH COLLABORATORS (set from create_trip_1_city): Preserve ALL collaborators

                // Find the owner's userID
                const owner = collaborators.find(c => c.role === 'owner');
                if (!owner) {
                    console.error('[trip-view_main] No owner found in collaborators');
                    return;
                }
                ownerUserID = owner.userID; // Always use owner's userID as partition key

                // Use existing collaborators (sanitized) - PRESERVE ALL
                collaboratorsToSave = collaborators.map(collaborator => ({
                    email: collaborator.email,
                    fullName: collaborator.fullName,
                    username: collaborator.username || collaborator.email.split('@')[0], // Fallback for legacy data
                    userID: collaborator.userID,
                    role: collaborator.role,
                    addedBy: collaborator.addedBy
                }));
                console.log('[trip-view_main] Using existing collaborators from context (may be from create_trip_1_city)');
            } else {
                // FALLBACK: Trip has tripId but no collaborators (edge case)
                // This shouldn't happen in normal flow, but handle it gracefully
                ownerUserID = currentUserID;
                collaboratorsToSave = [{
                    email: currentUserEmail,
                    fullName: currentUserName,
                    username: currentUsername,
                    userID: currentUserID,
                    role: 'owner',
                    addedBy: currentUserName
                }];
                console.warn('[trip-view_main] Trip has tripId but no collaborators - setting current user as owner');
            }

            // Add OWNER's userID and collaborators to trip data
            // This ensures we always use the owner's userID as the partition key in DynamoDB
            // NOTE: Version field removed - operations handle conflict resolution via timestamps

            const tripDataWithUser = {
                ...tripData,
                userID: ownerUserID, // Always use owner's userID, not current user's userID
                collaborators: collaboratorsToSave,
                // version field removed - no longer using optimistic locking
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: currentUserEmail
            };

            // Make the API call (now using public auth)
            const result: any = await API.graphql({
                query: createTrip,
                variables: { input: tripDataWithUser }
            });

            // Update local state after successful save
            if (result.data?.createTrip) {
                setUpdatedAt(result.data.createTrip.updatedAt);
                setLastUpdatedBy(result.data.createTrip.lastUpdatedBy);
                // Note: No version tracking needed with operation-based architecture
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
            // Only update if this was a brand new trip without any collaborators
            // If collaborators exist (from create_trip_1_city), keep them as-is
            if (isBrandNewTrip) {
                setCollaborators(collaboratorsToSave);
                console.log('[trip-view_main] Collaborators initialized after first save');
            } else {
                console.log('[trip-view_main] Keeping existing collaborators (may include invites from create_trip_1_city)');
            }

        } catch (error: any) {
            console.error('[trip-view_main] Error saving trip:', error);
            // Note: No version rollback needed - using operation-based architecture
            throw error;
        } finally {
            // Release save lock (both state and ref)
            isSavingRef.current = false;
            setIsSaving(false);
        }
    };

    /**
     * Stage 2: Verification Function
     * Verifies that the current trip state can be reconstructed from operations
     * This runs in "dual-write mode" - we save both the full trip AND verify reconstruction
     */
    const verifyTripReconstruction = async () => {
        try {
            const currentTripId = tripIdRef.current;
            if (!currentTripId) {
                console.log('[verifyTripReconstruction] No tripId - skipping verification');
                return;
            }

            console.log('[verifyTripReconstruction] 🔍 Starting verification for trip:', currentTripId);

            // Fetch all operations for this trip from DynamoDB
            const operations = await listOperations(currentTripId);
            console.log('[verifyTripReconstruction] Loaded', operations.length, 'operations from DynamoDB');

            if (operations.length === 0) {
                console.log('[verifyTripReconstruction] No operations yet - skipping verification');
                return;
            }

            // Get current state
            const {
                activities: latestActivities,
                dayActivities: latestDayActivities,
            } = latestTripDataRef.current;

            // Calculate wishlist (activities not assigned to any day)
            const dayActivityInstanceIds = Object.values(latestDayActivities)
                .flatMap((day: any) => day.activities.map((a: Activity) => a.instanceId))
                .filter(Boolean);

            const wishlist = (latestActivities || []).filter(
                (activity: Activity) => !activity.instanceId || !dayActivityInstanceIds.includes(activity.instanceId)
            );

            // Run verification - cast operations to AnyOperation[]
            const result = verifyStateReconstruction(wishlist, latestDayActivities, operations as any);

            if (result.isMatch) {
                console.log('[verifyTripReconstruction] ✅ VERIFICATION PASSED - Reconstruction matches actual state!');
            } else {
                console.error('[verifyTripReconstruction] ❌ VERIFICATION FAILED - Differences found:');
                result.differences.forEach((diff) => console.error('  - ' + diff));

                // Log detailed state comparison for debugging
                console.log('[verifyTripReconstruction] 📊 Actual wishlist count:', result.actualState.wishlist.length);
                console.log('[verifyTripReconstruction] 📊 Reconstructed wishlist count:', result.reconstructedState.wishlist.length);
                console.log('[verifyTripReconstruction] 📊 Actual days:', Object.keys(result.actualState.dayActivities).length);
                console.log('[verifyTripReconstruction] 📊 Reconstructed days:', Object.keys(result.reconstructedState.dayActivities).length);
            }

            return result;
        } catch (error) {
            console.error('[verifyTripReconstruction] ❌ Error during verification:', error);
        }
    };

    /**
     * Stage 2: Debugging utilities
     * Exposes verification and operation inspection functions for manual testing
     */
    useEffect(() => {
        // Expose debugging functions to console (dev only)
        if (__DEV__) {
            (global as any).verifyTrip = verifyTripReconstruction;
            (global as any).getOperationLog = () => {
                console.log('=== Current Operation Log ===');
                console.log('Total operations:', operationLogRef.current.length);
                console.log('Applied operations:', operationLogRef.current.filter(op => op.applied).length);
                console.log('Pending operations:', operationLogRef.current.filter(op => !op.applied).length);
                console.table(operationLogRef.current.map(op => ({
                    type: op.type,
                    target: op.target,
                    dayNumber: op.dayNumber,
                    applied: op.applied,
                    timestamp: new Date(op.timestamp).toLocaleTimeString(),
                })));
                return operationLogRef.current;
            };
            (global as any).getSaveQueue = () => {
                console.log('=== Current Save Queue ===');
                console.log('Queued operations:', saveQueueRef.current.operations.length);
                console.log('Is processing:', saveQueueRef.current.isProcessing);
                return saveQueueRef.current.operations;
            };
            (global as any).syncOperations = () => {
                console.log('=== Manually triggering operation sync ===');
                console.log('Last processed timestamp:', lastProcessedOperationTimestampRef.current);
                return syncNewOperations();
            };
            (global as any).getLastProcessedTimestamp = () => {
                const timestamp = lastProcessedOperationTimestampRef.current;
                console.log('Last processed timestamp:', timestamp);
                console.log('As date:', new Date(timestamp).toLocaleString());
                return timestamp;
            };

        }
    }, []);

    useEffect(() => {
        navigation.setOptions({
            headerShown: false,
            gestureEnabled: false, // Disable swipe-back gesture to prevent returning to create_trip_1_city
        });
    }, []);


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
                const updatedTrip = value?.data?.onTripUpdated;

                // Ignore if no data or if it's our own update
                if (!updatedTrip || updatedTrip.lastUpdatedBy === currentUserID) {
                    return;
                }

                console.log('[trip-view_main] Trip updated by another user - syncing operations...');

                // Update metadata & collaborators from full trip payload
                // Note: No version tracking needed with operation-based architecture
                setUpdatedAt(updatedTrip.updatedAt);
                setLastUpdatedBy(updatedTrip.lastUpdatedBy);
                if (updatedTrip.collaborators) {
                    setCollaborators(updatedTrip.collaborators);
                }

                // Sync date changes from remote
                if (updatedTrip.startDate !== undefined) {
                    setStartDate(updatedTrip.startDate);
                    latestTripDataRef.current.startDate = updatedTrip.startDate;
                }
                if (updatedTrip.endDate !== undefined) {
                    setEndDate(updatedTrip.endDate);
                    latestTripDataRef.current.endDate = updatedTrip.endDate;
                }
                if (updatedTrip.tripLength !== undefined && updatedTrip.tripLength !== null) {
                    setTripLength(updatedTrip.tripLength);
                    latestTripDataRef.current.tripLength = updatedTrip.tripLength;
                }

                // STAGE 3: Use incremental operation sync instead of full reload
                syncNewOperations();
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

    // Real-time subscription for TripOperation creations (Stage 3 - operation-level events)
    useEffect(() => {
        // Only subscribe if we have a tripId, a current user, and the screen is focused
        if (!tripId) {
            // console.log('[trip-view_main] Skipping operation subscription - no tripId');
            return;
        }

        if (!currentUserID) {
            // console.log('[trip-view_main] Skipping operation subscription - no currentUserID');
            return;
        }

        if (!isScreenFocused) {
            // console.log('[trip-view_main] Skipping operation subscription - screen not focused');
            return;
        }

        // console.log('[trip-view_main] Subscribing to TripOperation events for trip:', tripId);

        const subscription = (API.graphql(
            graphqlOperation(onCreateTripOperation, {
                filter: {
                    tripID: { eq: tripId }
                }
            })
        ) as any).subscribe({
            next: ({ value }: any) => {
                const op = value?.data?.onCreateTripOperation;
                if (!op) {
                    return;
                }

                // Ignore operations created by this client
                if (op.userId === currentUserID) {
                    return;
                }

                console.log(
                    '[trip-view_main] TripOperation created by another user - syncing operations...',
                    op.type,
                    op.target,
                    op.dayNumber
                );

                // Trigger incremental sync based on operations
                syncNewOperations();
            },
            error: (error: any) => {
                console.error('[trip-view_main] TripOperation subscription error:', error);
            }
        });

        return () => {
            // console.log('[trip-view_main] Unsubscribing from TripOperation events');
            subscription.unsubscribe();
        };
    }, [tripId, currentUserID, isScreenFocused, syncNewOperations]);

    // Initialize baseline timestamp for operation sync (Stage 3)
    useEffect(() => {
        if (!tripId) return;

        const initializeBaselineTimestamp = async () => {
            try {
                console.log('[trip-view_main] Initializing baseline timestamp for trip:', tripId);

                // Fetch all operations for this trip
                const allOperations = await listOperations(tripId);

                if (allOperations.length > 0) {
                    // Set baseline to the latest operation timestamp
                    const latestTimestamp = Math.max(...allOperations.map(op => op.timestamp));
                    lastProcessedOperationTimestampRef.current = latestTimestamp;
                    console.log('[trip-view_main] ✅ Baseline timestamp set to:', latestTimestamp, '(' + allOperations.length + ' existing operations)');

                    // Extract transport mode operations and populate the overrides ref
                    // Process operations in order (they should already be sorted by timestamp)
                    const transportModeOps = allOperations.filter(
                        op => op.type === 'update_transport_mode'
                    );

                    if (transportModeOps.length > 0) {
                        console.log('[trip-view_main] Found', transportModeOps.length, 'transport mode operations');

                        // Apply transport mode operations in order (LWW based on order)
                        const transportModes: TransportModeOverrides = {};
                        transportModeOps.forEach(op => {
                            const data = op.data as { originInstanceId: string; mode: TravelMode };
                            if (data.originInstanceId && data.mode && op.dayNumber !== undefined) {
                                const legKey = `${op.dayNumber}_${data.originInstanceId}`;
                                transportModes[legKey] = data.mode;
                            }
                        });

                        transportModeOverridesRef.current = transportModes;
                        console.log('[trip-view_main] ✅ Initialized', Object.keys(transportModes).length, 'transport mode overrides');
                    }
                } else {
                    // No operations yet - set to current time
                    lastProcessedOperationTimestampRef.current = Date.now();
                    console.log('[trip-view_main] ✅ No existing operations - baseline set to current time');
                }
            } catch (error) {
                console.error('[trip-view_main] ❌ Failed to initialize baseline timestamp:', error);
                // Fallback to current time
                lastProcessedOperationTimestampRef.current = Date.now();
            }
        };

        initializeBaselineTimestamp();
    }, [tripId]);

    // Get current user ID for collaboration features
    useEffect(() => {
        const getCurrentUser = async () => {
            try {
                const user = await Auth.currentAuthenticatedUser();
                // Use username (not sub) for consistency with collaborator storage
                // For Google OAuth users, username is like 'google_110194548211753772771'
                // For Apple OAuth users, username is like 'signinwithapple_000664.415e0f3e94404bee9a761c4921ebc4e2.2215'
                // For native users, username is their Cognito UUID
                const userID = user.username;
                console.log('[trip-view_main] Setting currentUserID:', userID);
                console.log('[trip-view_main] User details:', {
                    sub: user.attributes.sub,
                    username: user.username,
                    email: user.attributes.email
                });
                setCurrentUserID(userID);
            } catch (error) {
                console.error('[trip-view_main] Error getting current user:', error);
            }
        };

        getCurrentUser();
    }, []);

    // Clear processed saved places when trip changes
    useEffect(() => {
        processedSavedPlacesRef.current.clear();
        console.log('[trip-view_main] Cleared processed saved places ref for new trip');
    }, [tripId]);

    // Fetch saved places when component mounts or user changes
    useEffect(() => {
        // Clear processed ref when user changes or component mounts
        processedSavedPlacesRef.current.clear();

        const fetchSavedPlaces = async () => {
            if (!currentUserID) return;

            try {
                setLoadingSavedPlaces(true);
                
                const user = await Auth.currentAuthenticatedUser();
                const cognitoUsername = user.username; // e.g. signinwithapple_xxx for federated users
                const cognitoSub = user.attributes?.sub; // e.g. 34d8c438-... UUID
                
                // Query both identifiers to catch places saved under either one.
                // For native users these are the same; for federated (Google/Apple) users they differ.
                const ids = [cognitoUsername];
                if (cognitoSub && cognitoSub !== cognitoUsername) {
                    ids.push(cognitoSub);
                }
                
                console.log('[trip-view_main] Fetching saved places for userIDs:', ids);

                const results = await Promise.all(
                    ids.map(id =>
                        API.graphql({
                            query: getSavedPlacesDetailed,
                            variables: { userID: id },
                        })
                    )
                );

                // Merge results, deduplicating by savedPlaceId
                const seenIds = new Set<string>();
                const mergedPlaces: any[] = [];

                for (const result of results) {
                    const data = (result as any).data.getSavedPlaces;
                    for (const place of (data.savedPlaces || [])) {
                        if (!seenIds.has(place.savedPlaceId)) {
                            seenIds.add(place.savedPlaceId);
                            mergedPlaces.push(place);
                        }
                    }
                }

                console.log('[trip-view_main] Received saved places:', {
                    totalCount: mergedPlaces.length,
                    savedPlacesCount: mergedPlaces.length,
                    fromUserIDs: ids,
                });

                setAllSavedPlaces(mergedPlaces);
            } catch (error) {
                console.error('[trip-view_main] Error fetching saved places:', error);
            } finally {
                setLoadingSavedPlaces(false);
            }
        };

        fetchSavedPlaces();
    }, [currentUserID]);

    // Filter saved places by matching city and normalize them into trip activities
    useEffect(() => {
        if (!selectedCity) {
            console.log('[trip-view_main] No selectedCity - skipping saved places filter');
            return;
        }

        if (!allSavedPlaces.length) {
            console.log('[trip-view_main] No saved places to filter for city:', selectedCity);
            return;
        }

        console.log('[trip-view_main] Filtering', allSavedPlaces.length, 'saved places for city:', selectedCity);
        console.log('[trip-view_main] Current activities count:', activities?.length || 0);
        const filtered = filterSavedPlacesByCity(allSavedPlaces, selectedCity);
        console.log('[trip-view_main] Found', filtered.length, 'matching saved places');
        
        // Debug: Log cities in filtered saved places
        const cities = filtered.map(sp => sp.city || sp.activity?.city).filter(Boolean);
        console.log('[trip-view_main] Cities in filtered saved places:', [...new Set(cities)]);

        // Extract activity objects from saved places, preserving savedPlaceId
        const savedPlacesActivities = filtered
            .map((savedPlace) => {
                if (!savedPlace.activity) return null;
                // Attach savedPlaceId from the SavedPlace wrapper to the activity
                return {
                    ...savedPlace.activity,
                    savedPlaceId: savedPlace.savedPlaceId
                };
            })
            .filter((activity): activity is Activity => activity != null);

        if (savedPlacesActivities.length === 0) {
            console.log('[trip-view_main] No saved places activities to add');
            return;
        }

        // Save the short city name from Instagram saved places for display
        // Use the first activity's city name (more concise than selectedCity)
        if (savedPlacesActivities.length > 0 && savedPlacesActivities[0].city) {
            setDisplayCityName(savedPlacesActivities[0].city);
        }

        // Normalize saved places: add instanceIds and set correct city (preserving savedPlaceId)
        const normalizedActivities = ensureActivitiesHaveInstanceIds(
            savedPlacesActivities.map(activity => ({
                ...activity,
                city: selectedCity // Ensure they group under the same city for grouping
            }))
        );

        // Use functional update to access current activities without including it in dependencies
        // This prevents the effect from re-running every time activities change
        updateActivities((currentActivities: Activity[]) => {
            // Check which activities are not already in the trip
            // Use savedPlaceId + place_id combination to identify exact matches
            const existingSavedPlaceIds = new Set(
                (currentActivities || [])
                    .filter((a: Activity) => a.savedPlaceId)
                    .map((a: Activity) => `${a.savedPlaceId}_${a.place_id}`)
            );

            const newActivities = normalizedActivities.filter(activity => {
                const key = `${activity.savedPlaceId}_${activity.place_id}`;
                
                // Check if not already in trip
                if (existingSavedPlaceIds.has(key)) {
                    return false;
                }
                
                // Check if already processed in this session (prevents duplicate adds during rapid re-renders)
                if (activity.savedPlaceId && processedSavedPlacesRef.current.has(activity.savedPlaceId)) {
                    return false;
                }
                
                // Check if user has explicitly deleted this saved place from the trip
                if (activity.savedPlaceId && isDeletedSavedPlace(activity.savedPlaceId)) {
                    console.log('[trip-view_main] Filtering out deleted saved place:', activity.name, 'savedPlaceId:', activity.savedPlaceId);
                    return false;
                }
                
                return true;
            });

            // Add new Instagram saved places to the trip's activities
            if (newActivities.length > 0) {
                console.log('[trip-view_main] ✨ Adding', newActivities.length, 'new Instagram saved places to trip:', 
                    newActivities.map(a => a.name).join(', '));
                
                // Mark these as processed to prevent duplicate adds during rapid re-renders
                newActivities.forEach(activity => {
                    if (activity.savedPlaceId) {
                        processedSavedPlacesRef.current.add(activity.savedPlaceId);
                    }
                });
                
                return [...currentActivities, ...newActivities];
            } else {
                console.log('[trip-view_main] No new saved places to add (all already in trip or deleted)');
                return currentActivities;
            }
        });
    }, [selectedCity, allSavedPlaces, updateActivities, isDeletedSavedPlace]);

    // Handle collaboration modal
    const handleShareTrip = async () => {

        // For new trips (no tripId yet), initialize collaborators with current user as owner
        if (!tripId && collaborators.length === 0) {
            try {
                const currentUser = await Auth.currentAuthenticatedUser();
                // Use username (not sub) for consistency with collaborator storage
                const currentUserID = currentUser.username;
                const currentUserEmail = currentUser.attributes?.email || '';
                const currentUserName = currentUser.attributes?.name || '';
                const currentUsername = currentUser.attributes?.preferred_username || currentUser.username || currentUserEmail.split('@')[0];

                const ownerCollaborator = {
                    email: currentUserEmail,
                    fullName: currentUserName,
                    username: currentUsername,
                    userID: currentUserID,
                    role: 'owner',
                    addedBy: currentUserName
                };

                setCollaborators([ownerCollaborator]);
            } catch (error) {
                console.error('[trip-view_main] Error getting current user for collaborators:', error);
                // Alert.alert('Error', 'Unable to load user information for sharing');
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

    // Render primary tab toggle (Overview/Itinerary)
    const renderPrimaryTabs = () => (
        <View style={styles.primaryTabContainer}>
            <TouchableOpacity
                style={[styles.primaryTab, primaryTab === 'overview' && styles.primaryTabActive]}
                onPress={() => setPrimaryTab('overview')}
                activeOpacity={0.7}
            >
                <Text style={[styles.primaryTabText, primaryTab === 'overview' && styles.primaryTabTextActive]}>
                    Overview
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.primaryTab, primaryTab === 'itinerary' && styles.primaryTabActive]}
                onPress={() => {
                    setPrimaryTab('itinerary');
                    setActiveTab('wishlist');
                }}
                activeOpacity={0.7}
            >
                <Text style={[styles.primaryTabText, primaryTab === 'itinerary' && styles.primaryTabTextActive]}>
                    Itinerary
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Prepare day polylines for overview mode with color coding
    const overviewDayPolylines = useMemo(() => {
        if (primaryTab !== 'overview') return [];

        const sortedDayNumbers = Object.keys(dayActivities)
            .map(Number)
            .sort((a, b) => a - b);

        return sortedDayNumbers
            .map((dayNumber) => {
                const encodedPolyline = dayPolylines[dayNumber];
                if (!encodedPolyline) return null;

                try {
                    const coordinates = decodePolyline(encodedPolyline);
                    if (coordinates.length < 2) return null;

                    // Use the same color as the day marker in itinerary
                    const color = getMarkerColor(`day${dayNumber}` as TabType);

                    return {
                        dayNumber,
                        coordinates,
                        color,
                    };
                } catch (error) {
                    console.error(`[Overview] Failed to decode polyline for day ${dayNumber}:`, error);
                    return null;
                }
            })
            .filter((item): item is { dayNumber: number; coordinates: { latitude: number; longitude: number }[]; color: string } => item !== null);
    }, [primaryTab, dayPolylines, dayActivities]);

    // Extract route legs for each day from the routeCache for Overview display
    const dayRouteLegs = useMemo(() => {
        const result: { [dayNumber: number]: EnhancedRouteLeg[] } = {};

        Object.keys(dayActivities).forEach((dayNumberStr) => {
            const dayNumber = Number(dayNumberStr);
            const dayTab = `day${dayNumber}`;
            const cached = routeCache.current[dayTab];

            if (cached?.routeData?.legs) {
                result[dayNumber] = cached.routeData.legs as EnhancedRouteLeg[];
            }
        });

        return result;
    }, [dayActivities, routeData]); // Re-compute when route data changes

    // Create a map of activity instanceId to day number for marker coloring in overview mode
    const activityDayMap = useMemo(() => {
        if (primaryTab !== 'overview') return undefined;

        const map = new Map<string, number>();
        Object.keys(dayActivities).forEach((dayKey) => {
            const dayNumber = parseInt(dayKey);
            const dayData = dayActivities[dayNumber];
            if (dayData?.activities) {
                dayData.activities.forEach((activity: Activity) => {
                    if (activity.instanceId) {
                        map.set(activity.instanceId, dayNumber);
                    }
                });
            }
        });
        return map;
    }, [primaryTab, dayActivities]);

    return (
        <>
            <TripMapView
                activities={primaryTab === 'overview' ? getAllDayActivities() : getActivitiesForTab(activeTab)}
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
                currentHeightState={currentHeightState}
                heightStates={heightStates}
                allActivities={getAllActivitiesFromTrip()}
                selectedCityLocation={selectedCityLocation || undefined}
                dayPolylines={primaryTab === 'overview' ? overviewDayPolylines : undefined}
                activityDayMap={activityDayMap}
                routeData={activeTab.startsWith('day') ? {
                    legs: routeData.legs.map(leg => ({
                        distance: leg.modeData[leg.selectedMode]?.distance,
                        duration: leg.modeData[leg.selectedMode]?.duration,
                    }))
                } : undefined}
                onShareTrip={async () => {
                    if (!tripId) {
                        // Save trip first if it doesn't exist
                        try {
                            await saveTrip();
                            // Update timestamp only after successful save
                            lastSaveTimeRef.current = Date.now();
                        } catch (error) {
                            console.error('[trip-view_main] Save before share failed:', error);
                            // Still allow sharing even if save failed (trip might exist)
                        }
                    }
                    handleShareTrip();
                }}
            />

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

                {/* Navigation - show either primary toggle or TabBar */}
                {!showActivityDetail && (
                    primaryTab === 'overview' ? (
                        // Show Overview/Itinerary toggle
                        renderPrimaryTabs()
                    ) : (
                        // Show TabBar with Overview, Wishlist, Day tabs in primary style
                        <TabBar
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            dayCount={getDayCount()}
                            onAddDay={handleAddDay}
                            onDeleteDay={handleDeleteDay}
                            onReorderDays={handleReorderDays}
                            shouldScrollToActive={shouldScrollToActive}
                            tabLabels={tabLabels}
                            currentUserRole={currentUserRole}
                            startDate={startDate}
                            showOverviewTab={true}
                            showDayButtons={true}
                            usePrimaryStyle={true}
                        />
                    )
                )}

                {/* Tab Content */}
                <View style={styles.tabContent}>
                {showActivityDetail && selectedActivityForDetail ? (
                    <ActivityDetailView
                        activity={selectedActivityForDetail}
                        onClose={handleCloseActivityDetail}
                        showDragIndicator={false}
                        onDuplicate={(activity) => handleDuplicateActivity(activity, activeTab.startsWith('day') ? parseInt(activeTab.replace('day', '')) : undefined)}
                        onDelete={(activity) => handleDeleteActivity(activity, activeTab.startsWith('day') ? parseInt(activeTab.replace('day', '')) : undefined)}
                        currentUserRole={currentUserRole}
                        onScrollStateChange={handleActivityDetailScrollStateChange}
                    />
                ) : (
                <Pressable onPress={handleBackgroundTap} style={{ flex: 1 }}>
                    <>
                        {/* Overview Content - shown when primaryTab is 'overview' */}
                        {primaryTab === 'overview' && (
                            <Pressable onPress={handleBackgroundTap} style={{ flex: 1 }}>
                            <View style={styles.overviewWrapper}>
                                <OverviewContent
                                    tripTitle={tripTitle}
                                    onTitleChange={handleTitleChange}
                                    startDate={startDate}
                                    endDate={endDate}
                                    tripLength={tripLength}
                                    selectedCity={selectedCity || ''}
                                    dayActivities={dayActivities}
                                    activities={activities}
                                    onDayPress={handleOverviewDayPress}
                                    onDatePress={() => setDatePickerVisible(true)}
                                    currentUserRole={currentUserRole}
                                    collaborators={collaborators}
                                    dayRouteLegs={dayRouteLegs}
                                    onCollaboratorsPress={handleShareTrip}
                                />
                            </View>
                            </Pressable>
                        )}

                                {/* Wishlist/Saved Places Content - shown when in itinerary mode */}
                                {primaryTab === 'itinerary' && activeTab === 'wishlist' && (() => {
                                    const wishlistActivities = getActivitiesForTab('wishlist');
                                    const activitiesByCity = wishlistActivities.reduce((acc: { [key: string]: Activity[] }, activity) => {
                                        const city = activity.city || 'Unknown City';
                                        if (!acc[city]) acc[city] = [];
                                        acc[city].push(activity);
                                        return acc;
                                    }, {} as { [key: string]: Activity[] });

                                    return (
                                        <ScrollView
                                            ref={wishlistScrollViewRef}
                                            onScroll={(e) => { wishlistScrollPosRef.current = e.nativeEvent.contentOffset.y; }}
                                            scrollEventThrottle={16}
                                            style={styles.wishlistContainer}
                                            contentContainerStyle={styles.wishlistContent}
                                            showsVerticalScrollIndicator={false}
                                        >
                                            <Pressable onPress={handleBackgroundTap} style={{ flex: 1 }}>
                                                {wishlistActivities.length === 0 ? (
                                                    <View>
                                                        {/* City Title */}
                                                        {(displayCityName || selectedCity) && (
                                                            <Text style={styles.cityTitle}>{displayCityName || selectedCity}</Text>
                                                        )}

                                                        {/* SearchBar - right below city title, scrolls with content */}
                                                        {currentUserRole !== 'viewer' && (
                                                            <View style={styles.wishlistSearchBarContainer}>
                                                                <SearchBar
                                                                    value={searchQuery}
                                                                    onChangeText={handleSearchQueryChange}
                                                                    onPress={handleSearchPress}
                                                                    placeholder="Add places"
                                                                />
                                                            </View>
                                                        )}

                                                        {/* Category Cards - hide for viewers */}
                                                        {currentUserRole !== 'viewer' && (
                                                            <View style={styles.categoriesSection}>
                                                                <Text style={styles.categoriesTitle}>Browse by Category</Text>
                                                                {Array.isArray(cityCategories) && cityCategories.length > 0 ? (
                                                                    <View style={styles.categoriesGrid}>
                                                                        {cityCategories.map((category: any, index: number) => (
                                                                            <TouchableOpacity
                                                                                key={index}
                                                                                style={styles.categoryCard}
                                                                                onPress={() => handleCategoryPress(category)}
                                                                                activeOpacity={0.7}
                                                                            >
                                                                                <View style={styles.categoryContent}>
                                                                                    {category.emoji && (
                                                                                        <View style={styles.emojiContainer}>
                                                                                            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                                                                                        </View>
                                                                                    )}
                                                                                    <Text style={styles.categoryName}>{category.category}</Text>
                                                                                    <Text style={styles.categoryItems} numberOfLines={1}>
                                                                                        {category.category_items[0]}
                                                                                    </Text>
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                        ))}
                                                                    </View>
                                                                ) : (
                                                                    <View style={styles.loadingContainer}>
                                                                        <ActivityIndicator size="large" color={Colors.PRIMARY} />
                                                                        <Text style={styles.loadingText}>
                                                                            Loading categories for {selectedCity}...
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        )}
                                                    </View>
                                                ) : (
                                                    <>
                                                        {Object.entries(activitiesByCity).map(([city, cityActivities]: [string, Activity[]], cityIndex: number) => (
                                                            <View key={`wishlist-${city}`} style={styles.citySection}>
                                                                {/* City Title */}
                                                                <Text style={styles.cityTitle}>{displayCityName || city}</Text>

                                                                {/* SearchBar - right below city title (only for first city), scrolls with content */}
                                                                {cityIndex === 0 && currentUserRole !== 'viewer' && (
                                                                    <View style={styles.wishlistSearchBarContainer}>
                                                                        <SearchBar
                                                                            value={searchQuery}
                                                                            onChangeText={handleSearchQueryChange}
                                                                            onPress={handleSearchPress}
                                                                            placeholder="Add places"
                                                                        />
                                                                    </View>
                                                                )}

                                                                <WishlistActivities
                                                                    activities={cityActivities}
                                                                    selectedActivities={selectedActivities}
                                                                    onActivitySelect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                                                    onActivityDeselect={currentUserRole !== 'viewer' ? toggleActivitySelection : undefined}
                                                                    onDescriptionCardPress={handleActivityDescriptionCardSelect}
                                                                    showSelectionIndicator={isSelectionMode && currentUserRole !== 'viewer'}
                                                                    onDuplicate={currentUserRole !== 'viewer' ? handleDuplicateActivity : undefined}
                                                                    activeTab={activeTab}
                                                                    currentUserRole={currentUserRole}
                                                                    hideNotesButton={true}
                                                                    onDelete={currentUserRole !== 'viewer' ? handleDeleteActivity : undefined}
                                                                />
                                                            </View>
                                                        ))}

                                                        {/* Loading indicator while activity is being added from AutocompleteModal */}
                                                        {isAutocompleteAddingPlace && (
                                                            <View style={styles.autocompleteLoadingContainer}>
                                                                <ActivityIndicator size="small" color={Colors.PRIMARY} />
                                                                <Text style={styles.autocompleteLoadingText}>Activity Loading</Text>
                                                            </View>
                                                        )}

                                                        {/* Category Cards - hide for viewers */}
                                                        {currentUserRole !== 'viewer' && (
                                                            <View style={styles.categoriesSection}>
                                                                <Text style={styles.categoriesTitle}>Browse by Category</Text>
                                                                {Array.isArray(cityCategories) && cityCategories.length > 0 ? (
                                                                    <View style={styles.categoriesGrid}>
                                                                        {cityCategories.map((category: any, index: number) => (
                                                                            <TouchableOpacity
                                                                                key={index}
                                                                                style={styles.categoryCard}
                                                                                onPress={() => handleCategoryPress(category)}
                                                                                activeOpacity={0.7}
                                                                            >
                                                                                <View style={styles.categoryContent}>
                                                                                    {category.emoji && (
                                                                                        <View style={styles.emojiContainer}>
                                                                                            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                                                                                        </View>
                                                                                    )}
                                                                                    <Text style={styles.categoryName}>{category.category}</Text>
                                                                                    <Text style={styles.categoryItems} numberOfLines={1}>
                                                                                        {category.category_items[0]}
                                                                                    </Text>
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                        ))}
                                                                    </View>
                                                                ) : (
                                                                    <View style={styles.loadingContainer}>
                                                                        <ActivityIndicator size="large" color={Colors.PRIMARY} />
                                                                        <Text style={styles.loadingText}>
                                                                            Loading categories for {selectedCity}...
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        )}
                                                    </>
                                                )}
                                            </Pressable>
                                        </ScrollView>
                                    );
                                })()}

                        {/* Day Schedule Content - shown when in itinerary mode */}
                        {primaryTab === 'itinerary' && activeTab.startsWith('day') && (() => {
                            const currentDayNumber = parseInt(activeTab.replace('day', ''));
                            return (
                                <Pressable onPress={handleBackgroundTap} style={{ flex: 1 }}>
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
                                    onDuplicate={currentUserRole !== 'viewer' ? handleDuplicateActivity : undefined}
                                    isAddingPlaceFromAutocomplete={isAutocompleteAddingPlace}
                                    activeTab={activeTab}
                                    currentUserRole={currentUserRole}
                                    onOpenSettings={currentUserRole !== 'viewer' ? handleOpenSettings : undefined}
                                    onDelete={currentUserRole !== 'viewer' ? (activity, dayNumber) => handleDeleteActivity(activity, dayNumber) : undefined}
                                />
                                </Pressable>
                            );
                        })()}
                    </>
                </Pressable>
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
                    startDate={startDate}
                />
            </Animated.View>

            {/* AutocompleteModal for searching activities - new direct flow */}
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
                onSaveActivities={handleSaveSearchResults}
                showAddingPlaceLoading={false}
                onAddingPlaceChange={setIsAutocompleteAddingPlace}
                wishlistActivities={getActivitiesForTab('wishlist')}
                activeTab={activeTab}
            />

            {/* CategoryModal for browsing activities by category */}
            <CategoryModal
                visible={showCategoryModal}
                category={selectedCategory}
                activities={categoryActivities[selectedCategory] || []}
                loading={loadingCategoryActivities}
                loadingMore={loadingMoreCategoryActivities}
                onSave={handleSaveCategoryActivities}
                onClose={() => setShowCategoryModal(false)}
                onGenerateMore={handleGenerateMoreCategoryActivities}
                wishlistActivities={getActivitiesForTab('wishlist')}
                dayActivities={Object.values(dayActivities || {}).flatMap(dayObj =>
                    Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : []
                )}
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

            {/* Transportation Settings Modal */}
            {selectedLegIndex !== null && (
                <TransportationSettingsModal
                    visible={settingsModalVisible}
                    onClose={() => {
                        setSettingsModalVisible(false);
                        setSelectedLegIndex(null);
                        setModalOriginActivity(undefined);
                        setModalDestinationActivity(undefined);
                    }}
                    onSelectMode={handleSelectMode}
                    currentMode={(routeData.legs[selectedLegIndex] as any as EnhancedRouteLeg)?.selectedMode || 'DRIVE'}
                    modeData={(routeData.legs[selectedLegIndex] as any as EnhancedRouteLeg)?.modeData || {}}
                    loadingModes={(routeData.legs[selectedLegIndex] as any as EnhancedRouteLeg)?.loadingModes || []}
                    originActivity={modalOriginActivity}
                    destinationActivity={modalDestinationActivity}
                />
            )}

            {/* Date Picker Modal */}
            <SimpleDatePicker
                visible={datePickerVisible}
                onClose={() => setDatePickerVisible(false)}
                initialStartDate={startDate}
                initialEndDate={endDate}
                initialTripLength={tripLength}
                onSave={handleDateChange}
            />

            {/* Home button - hidden at MAX_HEIGHT */}
            {currentHeightState !== 2 && (
                <TouchableOpacity
                    style={styles.homeButton}
                    onPress={async () => {
                        const dayCountVal = getDayCount();

                        // Only save if user has edit permissions (owner or editor)
                        if (currentUserRole !== 'viewer') {
                            try {
                                await saveTrip();
                                // Update timestamp only after successful save
                                lastSaveTimeRef.current = Date.now();
                            } catch (error) {
                                console.error('[trip-view_main] Manual save failed:', error);
                                // Could show an alert to the user here if desired
                            }
                        } else {
                            console.log('[trip-view_main] Viewer navigating home - skipping save');
                        }

                        // Check if this is an existing trip (loaded from cloud) or a new trip
                        const isExistingTrip = tripId;

                        if (isExistingTrip) {
                            // This trip was loaded from cloud storage, go back to home/feed
                            router.push('/(tabs)/feed');
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
            )}
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
    primaryTabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: Colors.WHITE,
    },
    primaryTab: {
        flex: 1,
        paddingVertical: 11,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        marginHorizontal: 3,
        backgroundColor: '#F5F5F5',
    },
    primaryTabActive: {
        backgroundColor: '#E3F2FD',
        shadowColor: '#90CAF9',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    primaryTabText: {
        fontSize: 15,
        fontFamily: 'outfit-medium',
        color: '#6B7280',
        letterSpacing: -0.2,
    },
    primaryTabTextActive: {
        fontFamily: 'outfit-semibold',
        color: '#1976D2',
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
        marginHorizontal: 8, // Reduced from 20 to 5
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20, // Reduced from 20 to
        marginBottom: 40, // Space for transfer button
        overflow: 'visible', // Allow overflow for touch events
    },
    overviewWrapper: {
        flex: 1,
        marginHorizontal: -28, // Cancel parent's padding (20) + marginHorizontal (8)
        marginTop: -20, // Cancel parent's top padding
        marginBottom: -60, // Cancel parent's bottom padding (20) + marginBottom (40)
        overflow: 'visible', // Ensure touch events work with negative margins
    },
    citySection: {
        marginBottom: 5,
    },
    cityTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 25,
        marginTop: 0,
        textAlign: 'center',
        marginBottom: 13,
        color: '#1a1a1a',
    },
    wishlistContainer: {
        flex: 1,
    },
    wishlistSearchBarContainer: {
        marginBottom: -15,
    },
    wishlistContent: {
        paddingBottom: 20,
    },
    categoriesSection: {
        marginTop: -10,
        marginBottom: 20,
    },
    categoriesTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 18,
        color: '#333',
        marginBottom: 15,
        textAlign: 'center',
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    categoryCard: {
        width: '48%',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#e9ecef',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    categoryEmoji: {
        fontSize: 24,
        textAlign: 'center',
    },
    categoryName: {
        fontFamily: 'outfit-bold',
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
        marginBottom: 5,
    },
    categoryItems: {
        fontFamily: 'outfit',
        fontSize: 10,
        color: '#666',
        lineHeight: 16,
        textAlign: 'center',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#666',
        marginTop: 10,
    },
    autocompleteLoadingContainer: {
        marginTop: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    autocompleteLoadingText: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
    },
    savedPlacesSection: {
        marginTop: 20,
        marginBottom: 20,
    },
    savedPlacesTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 18,
        color: '#333',
        marginBottom: 15,
        textAlign: 'center',
    },
    savedPlacesContainer: {
        gap: 10,
    },
    savedPlaceCard: {
        marginBottom: 5,
    },
});
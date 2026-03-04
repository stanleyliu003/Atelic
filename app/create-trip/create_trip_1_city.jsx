import 'react-native-get-random-values';
import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View, ScrollView, Modal, Animated, PanResponder, Switch, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Alert, Dimensions, LogBox } from 'react-native';

// Suppress VirtualizedList nesting warning — GooglePlacesAutocomplete uses FlatList internally
LogBox.ignoreLogs(['VirtualizedLists should never be nested inside plain ScrollViews']);
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useCreateTrip } from '../../context/CreateTripContext';
import { API, Auth } from 'aws-amplify';
import { getCityCategories } from '../../src/graphql/queries';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CalendarPicker from 'react-native-calendar-picker';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';
import { createTrip } from '../../src/graphql/mutations';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UNSPLASH_ACCESS_KEY } from '../../src/constants/api';
import { trackUnsplashDownload } from '../../src/services/unsplashService';
import UnsplashInfoButton from '../../src/components/common/UnsplashInfoButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PLACEHOLDER_BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6telebu~qayj[j[fQayWBofofayayayj[fQj[ayayj[ayfjj[ay';

// Static curated background photo
const STATIC_HERO_URL = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&q=80';
const STATIC_HERO_ATTRIBUTION = {
    photographerName: 'Samuel Ferrara',
    photographerProfileUrl: 'https://unsplash.com/@samferrara',
    photoPageUrl: 'https://unsplash.com/photos/1527pjeb6jg',
    downloadLocationUrl: '',
};

// Glass-morphism constants
const GLASS_BG = 'rgba(255, 255, 255, 0.1)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.18)';
const GLASS_BG_STRONG = 'rgba(255, 255, 255, 0.14)';
const GLASS_BORDER_STRONG = 'rgba(255, 255, 255, 0.22)';

export default function create_trip_1_city({ showBackButton = true, prefilledCity: prefilledCityProp = null, fromSavedPlaces = null }) {
    const router = useRouter();
    const navigation = useNavigation();
    const params = useLocalSearchParams();
    const {
        setIsCreatingTrip,
        selectedCity,
        setSelectedCity,
        selectedCityLocation,
        setSelectedCityLocation,
        clearTripCreationCache,
        cityCategories,
        setCityCategories,
        tripLength,
        setTripLength,
        setStartDate: setContextStartDate,
        setEndDate: setContextEndDate,
        startDate: contextStartDate,
        endDate: contextEndDate,
        CACHE_KEYS,
        tripId,
        setTripId,
        generateTripId,
        collaborators,
        setCollaborators,
        setCreatedAt,
        activities,
        dayActivities,
        dayPolylines,
        tripPhotoReference,
        createdAt,
        recentSearches,
        isPublic,
        setIsPublic,
        setIsPublicLoaded
    } = useCreateTrip();
    const googlePlacesRef = useRef(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [isFlexibleDays, setIsFlexibleDays] = useState(false);
    const startDateRef = useRef(null);
    const [hasSelectedPlace, setHasSelectedPlace] = useState(false);
    const selectedCityRef = useRef(null);
    const [searchText, setSearchText] = useState('');
    const [isShareModalVisible, setIsShareModalVisible] = useState(false);
    const [currentUserID, setCurrentUserID] = useState('');
    const [isSavingTrip, setIsSavingTrip] = useState(false);
    
    // Local state for city selection - only commit to context when user presses "Next"
    const [localSelectedCity, setLocalSelectedCity] = useState('');
    const [localSelectedCityLocation, setLocalSelectedCityLocation] = useState(null);

    // Hero image state
    const [heroImageUrl, setHeroImageUrl] = useState(null);
    const [heroAttribution, setHeroAttribution] = useState(null);
    const insets = useSafeAreaInsets();


    // Pan responder for swipe-down gesture to close calendar
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Only respond to vertical swipes
                return Math.abs(gestureState.dy) > 5;
            },
            onPanResponderRelease: (evt, gestureState) => {
                // If swiped down more than 50 pixels, close the modal
                if (gestureState.dy > 50) {
                    setIsCalendarOpen(false);
                }
            },
        })
    ).current;

    // Format date to "Sat Nov 18" format
    const formatDate = (date) => {
        if (!date) return '';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const dayName = days[date.getDay()];
        const monthName = months[date.getMonth()];
        const dayNumber = date.getDate();

        return `${dayName} ${monthName} ${dayNumber}`;
    };

    // Note: CACHE_KEYS now comes from context

    // No longer loading cached values - fields should always start empty

    // Save city and categories to cache
    const saveCityToCache = async (city, categories) => {
        try {
            if (city) {
                await AsyncStorage.setItem(CACHE_KEYS.SELECTED_CITY, city);
            }
            if (categories) {
                await AsyncStorage.setItem(CACHE_KEYS.CITY_CATEGORIES, JSON.stringify(categories));
            }
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    };

    // Clear cache (useful when trip is completed or user wants to start fresh)
    const clearCache = async () => {
        try {
            await AsyncStorage.multiRemove([CACHE_KEYS.SELECTED_CITY, CACHE_KEYS.CITY_CATEGORIES]);
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    };

    useEffect(() => {
        navigation.setOptions({
            headerShown: false
        })

        // Set flag that user is creating a trip
        setIsCreatingTrip(true);

        // Ensure the GooglePlacesAutocomplete input is empty
        setTimeout(() => {
            if (googlePlacesRef.current) {
                googlePlacesRef.current.setAddressText('');
            }
        }, 100);

        // Ensure dropdown is closed when component mounts (after reset)
        setIsDropdownOpen(false);

        // Reset place selection state
        setHasSelectedPlace(false);
        selectedCityRef.current = null;

        // Get current user ID
        const getCurrentUser = async () => {
            try {
                const user = await Auth.currentAuthenticatedUser();
                const userID = user.username;
                setCurrentUserID(userID);
            } catch (error) {
                console.error('[create_trip_1_city] Error getting current user:', error);
            }
        };
        getCurrentUser();

        // Cleanup when component unmounts
        return () => {
            setIsCreatingTrip(false);
        };
    }, [])

    // Clear categories when localSelectedCity is cleared, but don't interfere with user input
    useEffect(() => {
        if (!localSelectedCity) {
            setCityCategories(null);
        }
    }, [localSelectedCity, setCityCategories])

    // Handle prefilled city from props or route params (e.g., from Saved Places)
    useEffect(() => {
        // Prefer prop over route params (prop is used when rendered as component)
        const prefilledCity = prefilledCityProp || params.prefilledCity;

        if (prefilledCity) {
            // Use setTimeout to ensure the GooglePlacesAutocomplete ref is ready
            setTimeout(() => {
                if (googlePlacesRef.current) {
                    // Set the text in the search field
                    googlePlacesRef.current.setAddressText(prefilledCity);
                    setSearchText(prefilledCity);
                    // Use LOCAL state instead of context
                    setLocalSelectedCity(prefilledCity);
                    selectedCityRef.current = prefilledCity;
                    setHasSelectedPlace(true);
                    // Fetch city categories for this city
                    fetchCityCategories(prefilledCity);
                } else {
                    console.warn('[create_trip_1_city] googlePlacesRef not ready after timeout');
                }
            }, 150);
        }
    }, [prefilledCityProp, params.prefilledCity])



    // Set static hero background image
    useEffect(() => {
        setHeroImageUrl(STATIC_HERO_URL);
        setHeroAttribution(STATIC_HERO_ATTRIBUTION);
    }, []);

    // Fetch city categories independently - this can be slow due to Gemini
    const fetchCityCategories = async (cityName) => {
        try {
            const categoriesResult = await API.graphql({
                query: getCityCategories,
                variables: { selectedCity: cityName }
            });
            
            const categories = categoriesResult.data.getCityCategories.categories;
            setCityCategories(categories);
            
            // No longer saving to cache - fields should always start empty
            
        } catch (error) {
            console.error('Error fetching city categories:', error);
            setCityCategories(null);
        }
    };

    // Helper function to sanitize activity objects for GraphQL input
    const sanitizeActivity = (activity) => {
        if (!activity) return null;
        const {
            __typename,
            regular_opening_hours,
            reviews,
            lastModified,
            modifiedBy,
            lastReordered,
            category,
            ...sanitized
        } = activity;

        // Ensure required String! fields have values
        sanitized.place_id = typeof sanitized.place_id === 'string' && sanitized.place_id.trim() !== '' ? sanitized.place_id : 'unknown_place';
        sanitized.name = typeof sanitized.name === 'string' && sanitized.name.trim() !== '' ? sanitized.name : 'Unknown Place';

        // Clean regular_opening_hours if it exists
        let cleanOpeningHours = null;
        if (regular_opening_hours) {
            const { __typename: openingTypename, periods, ...openingHoursRest } = regular_opening_hours;
            cleanOpeningHours = {
                ...openingHoursRest,
                ...(periods && {
                    periods: periods.map((period) => {
                        const { __typename: periodTypename, open, close, ...periodRest } = period;
                        const cleanPeriod = { ...periodRest };

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
            cleanReviews = reviews.map((review) => {
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

    // Save trip to database
    const saveTrip = async () => {
        try {
            setIsSavingTrip(true);
            console.log('[create_trip_1_city] Saving trip to database...');

            // Generate tripId if it doesn't exist
            let currentTripId = tripId;
            if (!currentTripId) {
                currentTripId = generateTripId();
                setTripId(currentTripId);
                console.log('[create_trip_1_city] Generated new tripId:', currentTripId);
            }

            // Generate createdAt if it doesn't exist
            let tripCreatedAt = createdAt;
            if (!tripCreatedAt) {
                tripCreatedAt = new Date().toISOString();
                setCreatedAt(tripCreatedAt);
                console.log('[create_trip_1_city] Generated new createdAt:', tripCreatedAt);
            }

            // Get current user information
            const currentUser = await Auth.currentAuthenticatedUser();
            const currentUserID = currentUser.username;
            const currentUserEmail = currentUser.attributes?.email || '';
            const currentUserName = currentUser.attributes?.name || '';
            const currentUsername = currentUser.attributes?.preferred_username || currentUser.username || currentUserEmail.split('@')[0];

            // Initialize collaborators with current user as owner if not already set
            let collaboratorsToSave;
            if (collaborators.length === 0) {
                const ownerCollaborator = {
                    email: currentUserEmail,
                    fullName: currentUserName,
                    username: currentUsername,
                    userID: currentUserID,
                    role: 'owner',
                    addedBy: currentUserName
                };
                collaboratorsToSave = [ownerCollaborator];
                setCollaborators(collaboratorsToSave);
            } else {
                collaboratorsToSave = collaborators.map(collaborator => ({
                    email: typeof collaborator.email === 'string' && collaborator.email.trim() !== '' ? collaborator.email : 'unknown@email.com',
                    fullName: typeof collaborator.fullName === 'string' && collaborator.fullName.trim() !== '' ? collaborator.fullName : 'Unknown User',
                    username: typeof collaborator.username === 'string' && collaborator.username.trim() !== '' ? collaborator.username : (collaborator.email?.split('@')[0] || 'unknown'),
                    userID: typeof collaborator.userID === 'string' && collaborator.userID.trim() !== '' ? collaborator.userID : 'unknown_user',
                    role: collaborator.role || 'viewer',
                    // addedBy is String! - use fullName as fallback
                    addedBy: typeof collaborator.addedBy === 'string' && collaborator.addedBy.trim() !== '' ? collaborator.addedBy : (collaborator.fullName || 'system')
                }));
            }

            // Gather days and their activities (will be empty at this point)
            const days = Object.keys(dayActivities || {}).map(dayNumber => ({
                dayNumber: Number(dayNumber),
                activities: (dayActivities[dayNumber]?.activities || []).map(sanitizeActivity).filter(Boolean),
                encodedPolyline: (dayPolylines || {})[dayNumber] || null,
            }));

            // Gather wishlist activities (sanitize them)
            const dayActivityInstanceIds = days.flatMap(day => day.activities.map(a => a?.instanceId)).filter(Boolean);
            const wishlist = (activities || [])
                .filter((activity) => !activity?.instanceId || !dayActivityInstanceIds.includes(activity.instanceId))
                .map(sanitizeActivity)
                .filter(Boolean);

            // Sanitize cityCategories - filter out items with empty/invalid category (String!)
            const cleanCityCategories = Array.isArray(cityCategories)
                ? cityCategories
                    .filter((c) => c && typeof c?.category === 'string' && c.category.trim() !== '')
                    .map((c) => ({
                        category: c.category,
                        category_items: Array.isArray(c?.category_items) ? c.category_items.filter(i => typeof i === 'string' && i.trim() !== '') : [],
                        ...(typeof c?.emoji === 'string' ? { emoji: c.emoji } : {})
                    }))
                : null;

            // Sanitize recentSearches - filter out items with empty/invalid required String! fields
            const cleanRecentSearches = Array.isArray(recentSearches)
                ? recentSearches
                    .filter((rs) => rs && typeof rs?.place_id === 'string' && rs.place_id.trim() !== '' && typeof rs?.name === 'string' && rs.name.trim() !== '')
                    .map((rs) => {
                        const { __typename, ...rest } = rs || {};
                        return {
                            place_id: rest.place_id,
                            name: rest.name,
                            address_info: rest.address_info || null,
                            timestamp: typeof rest.timestamp === 'string' && rest.timestamp.trim() !== '' ? rest.timestamp : new Date().toISOString(),
                        };
                    })
                : [];

            // Prepare trip data
            const tripData = {
                tripId: currentTripId,
                userID: currentUserID, // Owner's userID
                days,
                wishlist,
                tripLength: tripLength,
                selectedCity: localSelectedCity || selectedCity, // Use local state if available, fallback to context
                tripPhotoReference: Array.isArray(tripPhotoReference)
                    ? tripPhotoReference
                    : (tripPhotoReference ? [String(tripPhotoReference)] : []),
                createdAt: tripCreatedAt,
                startDate: contextStartDate || null,
                endDate: contextEndDate || null,
                cityCategories: cleanCityCategories || null,
                recentSearches: cleanRecentSearches,
                collaborators: collaboratorsToSave,
                version: 1,
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: currentUserEmail,
                deletedSavedPlaceIds: [], // Empty for new trips
                isPublic: isPublic === true ? true : false
            };

            // Save to database
            const result = await API.graphql({
                query: createTrip,
                variables: { input: tripData }
            });

            console.log('[create_trip_1_city] Trip saved successfully:', result);
            setIsSavingTrip(false);
            return true;
        } catch (error) {
            console.error('[create_trip_1_city] Error saving trip:', error);
            setIsSavingTrip(false);
            throw error;
        }
    };

    const handleInviteTripmate = async () => {
        try {
            // Save trip to database first
            await saveTrip();

            // Now open ShareTripModal (trip exists in DB, so addCollaborator will work)
            setIsShareModalVisible(true);
        } catch (error) {
            console.error('[create_trip_1_city] Error saving trip before invite:', error);
            // Could show an alert to user here
        }
    };

    const handleCollaboratorsUpdate = (updatedCollaborators) => {
        setCollaborators(updatedCollaborators);
    };

    const handleNext = async () => {
        if (!localSelectedCity || !tripLength) {
            return;
        }

        // ✨ COMMIT LOCAL STATE TO CONTEXT - Only update when user explicitly presses "Next"
        // This prevents saved places from being added for cities that were selected but then changed
        console.log('[create_trip_1_city] Committing city to context:', localSelectedCity);
        setSelectedCity(localSelectedCity);
        setSelectedCityLocation(localSelectedCityLocation);

        // Clear categories cache when user moves forward
        // This ensures categories won't show if user goes back to this page
        try {
            await AsyncStorage.removeItem(CACHE_KEYS.CITY_CATEGORIES);
        } catch (error) {
            console.error('Error clearing categories cache:', error);
        }

        // Pass fromSavedPlaces param if present
        if (fromSavedPlaces === 'true') {
            router.push({
                pathname: 'trip-view/trip-view_main',
                params: { fromSavedPlaces: 'true' }
            });
        } else {
            router.push('trip-view/trip-view_main');
        }
    };

    const dayOptions = Array.from({ length: 30 }, (_, i) => i + 1);

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#000' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <View style={{ flex: 1 }}>
                {/* ===== FULL-BLEED BACKGROUND ===== */}
                <View style={StyleSheet.absoluteFillObject}>
                    {heroImageUrl ? (
                        <Image
                            source={{ uri: heroImageUrl }}
                            style={StyleSheet.absoluteFillObject}
                            contentFit="cover"
                            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
                            transition={600}
                            cachePolicy="disk"
                        />
                    ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} />
                    )}
                    {/* Dark overlay for text readability */}
                    <View style={styles.photoOverlay} />
                </View>

                {/* ===== BACK BUTTON (fixed) ===== */}
                {showBackButton && (
                    <TouchableOpacity
                        onPress={() => router.replace('(tabs)/create_new_trip')}
                        style={[styles.backButton, { top: insets.top + 10 }]}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <View style={styles.backButtonCircle}>
                            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                )}

                {/* ===== UNSPLASH ATTRIBUTION (fixed) ===== */}
                {heroAttribution && (
                    <View style={[styles.unsplashContainer, { top: insets.top }]}>
                        <UnsplashInfoButton attribution={heroAttribution} />
                    </View>
                )}

                {/* ===== SCROLLABLE CONTENT ===== */}
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        bounces={true}
                    >
                        {/* Spacer — shrinks when trip details are visible so everything fits */}
                        <View style={{ height: (localSelectedCity && hasSelectedPlace) ? SCREEN_HEIGHT * 0.15 : SCREEN_HEIGHT * 0.32 }} />

                        {/* Title on photo */}
                        <Text style={styles.heroTitle}>Where do you{'\n'}want to go?</Text>

                        {/* Search Bar - glass effect on photo */}
                        <View style={styles.searchWrapper}>
                            <View style={styles.searchIconContainer}>
                                <Feather name="search" size={18} color="rgba(255,255,255,0.7)" />
                            </View>
                            <GooglePlacesAutocomplete
                                ref={googlePlacesRef}
                                placeholder='Search a city...'
                                onPress={async (data, details = null) => {
                                    setLocalSelectedCity(data.description);
                                    selectedCityRef.current = data.description;
                                    setHasSelectedPlace(true);
                                    if (details && details.geometry && details.geometry.location) {
                                        const { lat, lng } = details.geometry.location;
                                        setLocalSelectedCityLocation({ lat, lng });
                                    } else {
                                        setLocalSelectedCityLocation(null);
                                    }
                                    if (googlePlacesRef.current) {
                                        googlePlacesRef.current.setAddressText(data.description);
                                    }
                                    fetchCityCategories(data.description);
                                }}
                                query={{
                                    key: process.env.EXPO_PUBLIC_GOOGLE_MAP_KEY,
                                    language: 'en',
                                    types: '(regions)',
                                }}
                                textInputProps={{
                                    autoCorrect: false,
                                    autoComplete: 'off',
                                    autoCapitalize: 'words',
                                    spellCheck: false,
                                    placeholderTextColor: 'rgba(255,255,255,0.45)',
                                    onChangeText: (text) => {
                                        setSearchText(text);
                                        if (text !== selectedCityRef.current) {
                                            setHasSelectedPlace(false);
                                        }
                                    },
                                }}
                                renderRow={(rowData) => (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Text style={{ fontFamily: 'outfit-medium', fontSize: 15, color: '#FFFFFF', flex: 1 }} numberOfLines={1}>
                                            {rowData.structured_formatting?.main_text || rowData.description}
                                            {rowData.structured_formatting?.secondary_text ? (
                                                <Text style={{ fontFamily: 'outfit', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                                                    {'  '}
                                                    {rowData.structured_formatting.secondary_text}
                                                </Text>
                                            ) : null}
                                        </Text>
                                    </View>
                                )}
                                styles={{
                                    container: {
                                        flex: 0,
                                        zIndex: 100,
                                    },
                                    textInputContainer: {
                                        flexDirection: 'row',
                                        width: '100%',
                                    },
                                    textInput: {
                                        height: 54,
                                        color: '#FFFFFF',
                                        fontSize: 16,
                                        fontFamily: 'outfit',
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.2)',
                                        borderRadius: 16,
                                        backgroundColor: 'rgba(255,255,255,0.12)',
                                        paddingHorizontal: 16,
                                        paddingLeft: 46,
                                        flex: 1,
                                    },
                                    listView: {
                                        backgroundColor: GLASS_BG_STRONG,
                                        borderRadius: 16,
                                        marginTop: 8,
                                        zIndex: 1000,
                                        overflow: 'hidden',
                                        borderWidth: 1,
                                        borderColor: GLASS_BORDER_STRONG,
                                    },
                                    row: {
                                        backgroundColor: 'transparent',
                                        paddingVertical: 13,
                                        paddingHorizontal: 16,
                                    },
                                    description: {
                                        fontFamily: 'outfit',
                                        fontSize: 15,
                                        color: '#FFFFFF',
                                    },
                                    separator: {
                                        height: StyleSheet.hairlineWidth,
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        marginHorizontal: 16,
                                    },
                                }}
                                fetchDetails={true}
                                enablePoweredByContainer={false}
                                debounce={200}
                                flatListProps={{
                                    nestedScrollEnabled: true,
                                    scrollEnabled: false,
                                    keyboardShouldPersistTaps: 'handled',
                                }}
                            />
                        </View>

                        {/* Instruction text */}
                        {searchText && !hasSelectedPlace && (
                            <View style={styles.instructionContainer}>
                                <Text style={styles.instructionText}>Select a destination from the results</Text>
                            </View>
                        )}

                        {/* ===== TRIP DETAILS (glass cards on photo) ===== */}
                        {localSelectedCity && hasSelectedPlace && (
                            <View style={styles.detailsSection}>
                                <Text style={styles.detailsSectionTitle}>Trip details</Text>

                                {/* Calendar Button */}
                                <TouchableOpacity
                                    style={styles.glassRow}
                                    onPress={() => setIsCalendarOpen(true)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.glassRowLeft}>
                                        <View style={styles.glassIconCircle}>
                                            <MaterialCommunityIcons name="calendar-clock-outline" size={20} color="#FFFFFF" />
                                        </View>
                                        <View>
                                            <Text style={styles.glassRowLabel}>Dates</Text>
                                            <Text style={[styles.glassRowValue, !tripLength && styles.glassPlaceholder]}>
                                                {startDate && endDate
                                                    ? `${formatDate(startDate)}  —  ${formatDate(endDate)}`
                                                    : tripLength
                                                    ? `${tripLength} day${tripLength > 1 ? 's' : ''}`
                                                    : 'Choose your dates'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                                </TouchableOpacity>

                                {/* Calendar Modal */}
                                <Modal
                                    visible={isCalendarOpen}
                                    transparent={true}
                                    animationType="slide"
                                    onRequestClose={() => setIsCalendarOpen(false)}
                                >
                                    <View style={styles.modalOverlay}>
                                        <TouchableOpacity
                                            style={styles.modalBackdrop}
                                            activeOpacity={1}
                                            onPress={() => setIsCalendarOpen(false)}
                                        />
                                        <View style={styles.modalContent}>
                                            <View {...panResponder.panHandlers} style={styles.modalHandleContainer}>
                                                <View style={styles.modalHandle} />
                                            </View>

                                            <View style={styles.modalHeader}>
                                                <View style={styles.toggleContainer}>
                                                    <Text style={styles.toggleLabel}>Flexible days</Text>
                                                    <Switch
                                                        value={isFlexibleDays}
                                                        onValueChange={(value) => {
                                                            setIsFlexibleDays(value);
                                                            startDateRef.current = null;
                                                            setStartDate(null);
                                                            setContextStartDate(null);
                                                            setEndDate(null);
                                                            setContextEndDate(null);
                                                            setTripLength(null);
                                                        }}
                                                        trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#F36406' }}
                                                        thumbColor={'#FFFFFF'}
                                                        ios_backgroundColor="rgba(255,255,255,0.2)"
                                                    />
                                                </View>
                                            </View>

                                            {!isFlexibleDays ? (
                                                <View style={styles.calendarContainer}>
                                                    <CalendarPicker
                                                        startFromMonday={false}
                                                        allowRangeSelection={true}
                                                        minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                                                        maxDate={new Date(new Date().setFullYear(new Date().getFullYear() + 3))}
                                                        todayBackgroundColor="rgba(243, 100, 6, 0.2)"
                                                        todayTextStyle={{ color: '#FFA53F' }}
                                                        selectedDayColor="#F36406"
                                                        selectedDayTextColor="#FFFFFF"
                                                        selectedRangeStartStyle={{ backgroundColor: '#F36406' }}
                                                        selectedRangeEndStyle={{ backgroundColor: '#F36406' }}
                                                        selectedRangeStyle={{ backgroundColor: 'rgba(243, 100, 6, 0.2)' }}
                                                        selectedStartDate={startDate}
                                                        selectedEndDate={endDate}
                                                        enableSwipe={true}
                                                        weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
                                                        allowBackwardRangeSelect={true}
                                                        disabledDatesTextStyle={{ color: 'rgba(255,255,255,0.15)' }}
                                                        customDayHeaderStyles={() => ({ textStyle: { color: 'rgba(255,255,255,0.5)', fontFamily: 'outfit' } })}
                                                        onDateChange={async (date, type) => {
                                                            if (type === 'END_DATE') {
                                                                if (!date) {
                                                                    setEndDate(null);
                                                                    setContextEndDate(null);
                                                                    setTripLength(null);
                                                                    return;
                                                                }
                                                                const currentStartDate = startDateRef.current;
                                                                if (currentStartDate) {
                                                                    const normalizedStart = new Date(currentStartDate);
                                                                    normalizedStart.setHours(0, 0, 0, 0);
                                                                    const normalizedEnd = new Date(date);
                                                                    normalizedEnd.setHours(0, 0, 0, 0);
                                                                    const timeDiff = normalizedEnd.getTime() - normalizedStart.getTime();
                                                                    if (timeDiff < 0) {
                                                                        const newStartDate = date;
                                                                        const newEndDate = currentStartDate;
                                                                        const swappedTimeDiff = normalizedStart.getTime() - normalizedEnd.getTime();
                                                                        const swappedDays = Math.round(swappedTimeDiff / (1000 * 60 * 60 * 24)) + 1;
                                                                        startDateRef.current = newStartDate;
                                                                        setStartDate(newStartDate);
                                                                        setContextStartDate(newStartDate.toISOString());
                                                                        setEndDate(newEndDate);
                                                                        setContextEndDate(newEndDate.toISOString());
                                                                        setTripLength(swappedDays);
                                                                    } else {
                                                                        const days = Math.round(timeDiff / (1000 * 60 * 60 * 24)) + 1;
                                                                        setEndDate(date);
                                                                        setContextEndDate(date.toISOString());
                                                                        setTripLength(days);
                                                                    }
                                                                    try {
                                                                        await saveTrip();
                                                                    } catch (error) {
                                                                        console.error('[create_trip_1_city] Error saving trip after date selection:', error);
                                                                    }
                                                                }
                                                            } else {
                                                                startDateRef.current = date;
                                                                setStartDate(date);
                                                                setContextStartDate(date.toISOString());
                                                                setEndDate(null);
                                                                setContextEndDate(null);
                                                                setTripLength(null);
                                                            }
                                                        }}
                                                        width={350}
                                                        textStyle={{ fontFamily: 'outfit', fontSize: 16, color: '#FFFFFF' }}
                                                        monthTitleStyle={{ fontFamily: 'outfit-bold', fontSize: 24, color: '#FFFFFF' }}
                                                        yearTitleStyle={{ fontFamily: 'outfit-bold', fontSize: 24, color: '#FFFFFF' }}
                                                        dayLabelsWrapper={{ borderTopWidth: 0, borderBottomWidth: 0 }}
                                                        previousComponent={<Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.6)" />}
                                                        nextComponent={<Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.6)" />}
                                                    />
                                                </View>
                                            ) : (
                                                <View style={styles.flexibleDaysContainer}>
                                                    <View style={styles.dropdownContainer}>
                                                        <TouchableOpacity
                                                            style={styles.dropdownButton}
                                                            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                                                        >
                                                            <View style={styles.dropdownContent}>
                                                                <MaterialCommunityIcons name="calendar-clock-outline" size={24} color="rgba(255,255,255,0.7)" />
                                                                <Text style={[styles.dropdownButtonText, !tripLength && styles.placeholderText]}>
                                                                    {tripLength ? `${tripLength} day${tripLength > 1 ? 's' : ''}` : 'Select number of days'}
                                                                </Text>
                                                            </View>
                                                            <Text style={[styles.dropdownArrow, isDropdownOpen && styles.dropdownArrowOpen]}>
                                                                ▼
                                                            </Text>
                                                        </TouchableOpacity>

                                                        {isDropdownOpen && (
                                                            <View style={styles.dropdownList}>
                                                                <ScrollView style={styles.optionsList} nestedScrollEnabled={true}>
                                                                    {dayOptions.map(day => (
                                                                        <TouchableOpacity
                                                                            key={day}
                                                                            style={[styles.option, tripLength === day && styles.selectedOption]}
                                                                            onPress={async () => {
                                                                                setTripLength(day);
                                                                                setIsDropdownOpen(false);
                                                                                try {
                                                                                    await saveTrip();
                                                                                } catch (error) {
                                                                                    console.error('[create_trip_1_city] Error saving trip after flexible days selection:', error);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Text style={[styles.optionText, tripLength === day && styles.selectedOptionText]}>
                                                                                {day} day{day > 1 ? 's' : ''}
                                                                            </Text>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                </ScrollView>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                            )}

                                            <TouchableOpacity
                                                style={[styles.confirmButton, { opacity: tripLength ? 1 : 0.3 }]}
                                                onPress={() => { if (tripLength) setIsCalendarOpen(false); }}
                                                disabled={!tripLength}
                                            >
                                                <Text style={styles.confirmButtonText}>Confirm</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </Modal>

                                {/* Visibility Toggle */}
                                {tripLength && (
                                    <TouchableOpacity
                                        style={styles.glassRow}
                                        onPress={() => { setIsPublic(!isPublic); setIsPublicLoaded(true); }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.glassRowLeft}>
                                            <View style={styles.glassIconCircle}>
                                                <Ionicons
                                                    name={isPublic ? "eye" : "eye-off-outline"}
                                                    size={18}
                                                    color="#FFFFFF"
                                                />
                                            </View>
                                            <View>
                                                <Text style={styles.glassRowLabel}>Visibility</Text>
                                                <Text style={styles.glassRowValue}>
                                                    {isPublic ? 'Visible on profile' : 'Private trip'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Switch
                                            value={isPublic}
                                            onValueChange={(value) => { setIsPublic(value); setIsPublicLoaded(true); }}
                                            trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#F36406' }}
                                            thumbColor={'#FFFFFF'}
                                            ios_backgroundColor="rgba(255,255,255,0.2)"
                                        />
                                    </TouchableOpacity>
                                )}

                                {/* Invite Tripmate */}
                                {tripLength && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.glassRow, isSavingTrip && { opacity: 0.5 }]}
                                            onPress={handleInviteTripmate}
                                            disabled={isSavingTrip}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.glassRowLeft}>
                                                <View style={styles.glassIconCircle}>
                                                    {isSavingTrip ? (
                                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                                    ) : (
                                                        <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
                                                    )}
                                                </View>
                                                <View>
                                                    <Text style={styles.glassRowLabel}>Tripmates</Text>
                                                    <Text style={styles.glassRowValue}>
                                                        {isSavingTrip ? 'Saving...' : 'Add friends to this trip'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                                        </TouchableOpacity>

                                        {collaborators && collaborators.filter(c => c.role !== 'owner').length > 0 && (
                                            <View style={styles.tripmatesContainer}>
                                                {collaborators
                                                    .filter(c => c.role !== 'owner')
                                                    .map((collaborator, index) => (
                                                        <View key={collaborator.username || index} style={styles.tripmateChip}>
                                                            <Text style={styles.tripmateUsername}>@{collaborator.username}</Text>
                                                            <TouchableOpacity
                                                                onPress={async () => {
                                                                    try {
                                                                        const { API } = await import('aws-amplify');
                                                                        const { removeCollaborator } = await import('../../src/graphql/mutations');
                                                                        const result = await API.graphql({
                                                                            query: removeCollaborator,
                                                                            variables: { tripId, username: collaborator.username }
                                                                        });
                                                                        const updatedTrip = result.data?.removeCollaborator;
                                                                        if (updatedTrip?.collaborators) {
                                                                            setCollaborators(updatedTrip.collaborators);
                                                                        }
                                                                    } catch (error) {
                                                                        console.error('[create_trip_1_city] Error removing collaborator:', error);
                                                                        Alert.alert('Error', 'Failed to remove tripmate. Please try again.');
                                                                    }
                                                                }}
                                                                style={styles.tripmateRemoveButton}
                                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                            >
                                                                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                            </View>
                                        )}
                                    </>
                                )}

                                {/* Start Planning Button */}
                                {tripLength ? (
                                    <TouchableOpacity
                                        onPress={handleNext}
                                        style={[styles.nextButton, { marginTop: 16 }]}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={styles.nextButtonText}>Start Planning</Text>
                                        <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        )}

                        {/* Bottom spacer for tab bar clearance */}
                        <View style={{ height: 200 }} />
                    </ScrollView>
                </TouchableWithoutFeedback>
            </View>

            {/* Share Trip Modal */}
            {currentUserID && tripId && (
                <ShareTripModal
                    visible={isShareModalVisible}
                    onClose={() => setIsShareModalVisible(false)}
                    tripId={tripId}
                    collaborators={collaborators || []}
                    currentUserRole="owner"
                    currentUserID={currentUserID}
                    selectedCity={localSelectedCity || selectedCity}
                    onCollaboratorsUpdate={handleCollaboratorsUpdate}
                />
            )}
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    // ===== BACKGROUND =====
    photoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },

    // ===== FIXED ELEMENTS =====
    backButton: {
        position: 'absolute',
        left: 16,
        zIndex: 20,
    },
    backButtonCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: GLASS_BG,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: GLASS_BORDER,
    },
    unsplashContainer: {
        position: 'absolute',
        right: 0,
        left: 0,
        height: 60,
        zIndex: 15,
    },

    // ===== SCROLL CONTENT =====
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
    },

    // ===== TITLE =====
    heroTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 36,
        color: '#FFFFFF',
        lineHeight: 44,
        marginBottom: 24,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
    },

    // ===== SEARCH =====
    searchWrapper: {
        position: 'relative',
        zIndex: 100,
    },
    searchIconContainer: {
        position: 'absolute',
        left: 16,
        top: 18,
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: 18,
        width: 18,
    },

    // ===== INSTRUCTION =====
    instructionContainer: {
        marginTop: 16,
        alignItems: 'center',
    },
    instructionText: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
    },

    // ===== DETAILS SECTION (glass) =====
    detailsSection: {
        marginTop: 20,
        paddingBottom: 0,
    },
    detailsSectionTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 12,
        marginLeft: 4,
    },

    // ===== GLASS ROWS =====
    glassRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: GLASS_BG_STRONG,
        borderWidth: 1,
        borderColor: GLASS_BORDER_STRONG,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    glassRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    glassIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    glassRowLabel: {
        fontFamily: 'outfit',
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    glassRowValue: {
        fontFamily: 'outfit-medium',
        fontSize: 15,
        color: '#FFFFFF',
    },
    glassPlaceholder: {
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'outfit',
    },

    // ===== DROPDOWN (in calendar modal) =====
    dropdownContainer: {
        position: 'relative',
        zIndex: 1000,
    },
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        height: 52,
    },
    dropdownButtonText: {
        fontFamily: 'outfit',
        fontSize: 15,
        color: '#FFFFFF',
    },
    dropdownArrow: {
        fontFamily: 'outfit',
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        transform: [{ rotate: '0deg' }],
    },
    dropdownArrowOpen: {
        transform: [{ rotate: '180deg' }],
    },
    dropdownContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dropdownList: {
        position: 'absolute',
        top: 58,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        borderRadius: 16,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        zIndex: 1001,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    optionsList: {
        maxHeight: 200,
    },
    option: {
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    selectedOption: {
        backgroundColor: 'rgba(243, 100, 6, 0.2)',
    },
    optionText: {
        fontFamily: 'outfit',
        fontSize: 15,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    selectedOptionText: {
        fontFamily: 'outfit-bold',
        color: '#FFA53F',
    },
    placeholderText: {
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'outfit',
    },

    // ===== NEXT BUTTON =====
    nextButton: {
        paddingVertical: 16,
        backgroundColor: '#F36406',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 14,
        elevation: 10,
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontFamily: 'outfit-bold',
        fontSize: 17,
    },

    // ===== TRIPMATES =====
    tripmatesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingBottom: 10,
        paddingHorizontal: 4,
        gap: 8,
    },
    tripmateChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 20,
        paddingVertical: 6,
        paddingLeft: 12,
        paddingRight: 6,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    tripmateUsername: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#FFFFFF',
    },
    tripmateRemoveButton: {
        padding: 2,
    },

    // ===== CALENDAR MODAL =====
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        backgroundColor: '#1A1A1E',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '80%',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalHandleContainer: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 2,
    },
    modalHeader: {
        flexDirection: 'column',
        marginBottom: 20,
        marginTop: 8,
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: -4,
    },
    toggleLabel: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
    },
    flexibleDaysContainer: {
        height: 300,
        justifyContent: 'flex-start',
        paddingTop: 20,
    },
    calendarContainer: {
        height: 292,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButton: {
        backgroundColor: '#F36406',
        borderRadius: 16,
        paddingVertical: 16,
        marginTop: 35,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontFamily: 'outfit-bold',
        fontSize: 17,
    },
})
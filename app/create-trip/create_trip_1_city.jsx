import 'react-native-get-random-values';
import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View, ScrollView, Modal, Animated, PanResponder, Switch, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Alert } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useCreateTrip } from '../../context/CreateTripContext';
import { API, Auth } from 'aws-amplify';
import { getCityCategories } from '../../src/graphql/queries';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CalendarPicker from 'react-native-calendar-picker';
import { ShareTripModal } from '../../src/components/trip-view/collaboration';
import { createTrip } from '../../src/graphql/mutations';

export default function create_trip_1_city({ showBackButton = true, prefilledCity: prefilledCityProp = null }) {
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
        isVisibleOnProfile,
        setIsVisibleOnProfile
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

    // Clear categories when selectedCity is cleared, but don't interfere with user input
    useEffect(() => {
        if (!selectedCity) {
            setCityCategories(null);
        }
    }, [selectedCity, setCityCategories])

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
                    setSelectedCity(prefilledCity);
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
        const {
            __typename,
            regular_opening_hours,
            reviews,
            ...sanitized
        } = activity;

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
                    email: collaborator.email,
                    fullName: collaborator.fullName,
                    username: collaborator.username || collaborator.email.split('@')[0],
                    userID: collaborator.userID,
                    role: collaborator.role,
                    addedBy: collaborator.addedBy
                }));
            }

            // Gather days and their activities (will be empty at this point)
            const days = Object.keys(dayActivities || {}).map(dayNumber => ({
                dayNumber: Number(dayNumber),
                activities: (dayActivities[dayNumber]?.activities || []).map(sanitizeActivity),
                encodedPolyline: (dayPolylines || {})[dayNumber] || null,
            }));

            // Gather wishlist activities (sanitize them)
            const dayActivityInstanceIds = days.flatMap(day => day.activities.map(a => a.instanceId)).filter(Boolean);
            const wishlist = (activities || [])
                .filter((activity) => !activity.instanceId || !dayActivityInstanceIds.includes(activity.instanceId))
                .map(sanitizeActivity);

            // Sanitize cityCategories
            const cleanCityCategories = Array.isArray(cityCategories)
                ? cityCategories.map((c) => ({
                    category: c?.category,
                    category_items: Array.isArray(c?.category_items) ? c.category_items : [],
                    ...(typeof c?.emoji === 'string' ? { emoji: c.emoji } : {})
                }))
                : null;

            // Sanitize recentSearches
            const cleanRecentSearches = Array.isArray(recentSearches)
                ? recentSearches.map((rs) => {
                    const { __typename, ...rest } = rs || {};
                    return {
                        place_id: rest.place_id,
                        name: rest.name,
                        address_info: rest.address_info,
                        timestamp: rest.timestamp,
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
                selectedCity: selectedCity,
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
                isVisibleOnProfile: isVisibleOnProfile === true
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
        if (!selectedCity || !tripLength) {
            return;
        }

        // Clear categories cache when user moves forward
        // This ensures categories won't show if user goes back to this page
        try {
            await AsyncStorage.removeItem(CACHE_KEYS.CITY_CATEGORIES);
        } catch (error) {
            console.error('Error clearing categories cache:', error);
        }

        router.push('trip-view/trip-view_main');
    };

    const dayOptions = Array.from({ length: 30 }, (_, i) => i + 1);

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: Colors.WHITE }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={60}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{
                    padding: 25,
                    paddingTop: 40,
                    backgroundColor: Colors.WHITE,
                    minHeight: '100%'
                }}>
                    {/* Header Row */}
                    {showBackButton && (
                        <View style={styles.headerRow}>
                            <TouchableOpacity onPress={() => router.replace('(tabs)/create_new_trip')} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={32} color="black" />
                            </TouchableOpacity>
                        </View>
                    )}

                {/* Destination Prompt */}
                <View style={styles.promptSection}>                    
                    <Text style={styles.promptTitleCity}>Where do you want to go?</Text>
                </View>

                {/* Enter City */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchIconInsideContainer}>
                        <Feather name="search" size={24} color="black" />
                    </View>
                    <GooglePlacesAutocomplete
                        ref={googlePlacesRef}
                        placeholder='Ex: Boston, MA, USA'
                        onPress={async (data, details = null) => {
                            setSelectedCity(data.description);
                            selectedCityRef.current = data.description;
                            setHasSelectedPlace(true);
                            // Store selected city's coordinates for initial map centering
                            if (details && details.geometry && details.geometry.location) {
                                const { lat, lng } = details.geometry.location;
                                setSelectedCityLocation({ lat, lng });
                            } else {
                                setSelectedCityLocation(null);
                            }
                            // Update the text field to show the selected city immediately
                            if (googlePlacesRef.current) {
                                googlePlacesRef.current.setAddressText(data.description);
                            }
                            // Fetch city categories for trip planning (but don't save to cache)
                            fetchCityCategories(data.description); // Don't await - let it run independently
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
                            onChangeText: (text) => {
                                setSearchText(text);
                                // When user manually edits the text (different from selected city), hide the trip length section
                                if (text !== selectedCityRef.current) {
                                    setHasSelectedPlace(false);
                                }
                            },
                        }}
                        styles={{
                            container: {
                                flex: 0,
                                zIndex: 1,
                            },
                            textInputContainer: {
                                flexDirection: 'row',
                                width: '100%',
                            },
                            textInput: {
                                height: 55,
                                color: '#1a1a1a',
                                fontSize: 16,
                                fontFamily: 'outfit',
                                borderWidth: 0,
                                borderRadius: 20,
                                backgroundColor: '#ffffff',
                                paddingHorizontal: 15,
                                paddingLeft: 50,
                                flex: 1,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                elevation: 4,
                            },
                            listView: {
                                backgroundColor: 'white',
                                borderRadius: 15,
                                marginTop: 5,
                                elevation: 3,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                            },
                            row: {
                                backgroundColor: 'white',
                                padding: 13,
                                height: 44,
                                flexDirection: 'row',
                            },
                            description: {
                                fontFamily: 'outfit',
                                fontSize: 16,
                                color: '#1a1a1a',
                            },
                        }}
                        fetchDetails={true}
                        enablePoweredByContainer={false}
                        debounce={200}
                    />
                </View>

                {/* Instruction text when user has typed but not selected */}
                {searchText && !hasSelectedPlace && (
                    <View style={styles.instructionContainer}>
                        <Text style={styles.instructionText}>Select a destination from dropdown results</Text>
                    </View>
                )}

                {/* Trip Length Selection - Only show when a place has been selected from autocomplete */}
                {selectedCity && hasSelectedPlace && (
                    <View style={styles.tripLengthSection}>
                        <View style={styles.promptSection}>
                            <Text style={styles.promptTitle}>How long is your trip?</Text>
                        </View>

                        {/* Calendar Button */}
                        <View style={{ marginTop: -10 }}>
                            <TouchableOpacity
                                style={styles.calendarButton}
                                onPress={() => setIsCalendarOpen(true)}
                            >
                                <View style={styles.calendarButtonContent}>
                                    <MaterialCommunityIcons name="calendar-clock-outline" size={24} color="black" />
                                    <Text style={[styles.calendarButtonText, !tripLength && styles.placeholderText]}>
                                        {startDate && endDate
                                            ? `${formatDate(startDate)}   -   ${formatDate(endDate)}`
                                            : tripLength
                                            ? `${tripLength} day${tripLength > 1 ? 's' : ''}`
                                            : 'Select dates'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Calendar Modal */}
                        <Modal
                            visible={isCalendarOpen}
                            transparent={true}
                            animationType="slide"
                            onRequestClose={() => setIsCalendarOpen(false)}
                        >
                            <View style={styles.modalOverlay}>
                                {/* Backdrop - tap to close */}
                                <TouchableOpacity
                                    style={styles.modalBackdrop}
                                    activeOpacity={1}
                                    onPress={() => setIsCalendarOpen(false)}
                                />
                                <View style={styles.modalContent}>
                                    {/* Top Handle - Swipeable */}
                                    <View {...panResponder.panHandlers} style={styles.modalHandleContainer}>
                                        <View style={styles.modalHandle} />
                                    </View>

                                    {/* Header */}
                                    <View style={styles.modalHeader}>
                                        <View style={styles.toggleContainer}>
                                            <Text style={styles.toggleLabel}>Flexible days</Text>
                                            <Switch
                                                value={isFlexibleDays}
                                                onValueChange={(value) => {
                                                    setIsFlexibleDays(value);
                                                    // Clear all selections when switching modes
                                                    startDateRef.current = null;
                                                    setStartDate(null);
                                                    setContextStartDate(null);
                                                    setEndDate(null);
                                                    setContextEndDate(null);
                                                    setTripLength(null);
                                                }}
                                                trackColor={{ false: '#D1D5DB', true: '#FFA53F' }}
                                                thumbColor={isFlexibleDays ? '#FFFFFF' : '#f4f3f4'}
                                                ios_backgroundColor="#D1D5DB"
                                            />
                                        </View>
                                    </View>

                                    {/* Calendar or Flexible Days Dropdown */}
                                    {!isFlexibleDays ? (
                                        // Calendar View
                                        <View style={styles.calendarContainer}>
                                            <CalendarPicker
                                                startFromMonday={false}
                                                allowRangeSelection={true}
                                                minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                                                maxDate={new Date(new Date().setFullYear(new Date().getFullYear() + 3))}
                                                todayBackgroundColor="#E8F4FD"
                                                todayTextStyle={{ color: '#27BFFF' }}
                                                selectedDayColor="#FFA53F"
                                                selectedDayTextColor="#FFFFFF"
                                                selectedStartDate={startDate}
                                                selectedEndDate={endDate}
                                                enableSwipe={true}
                                                weekdays={['S', 'M', 'T', 'W', 'T', 'F', 'S']}
                                                allowBackwardRangeSelect={true}
                                            onDateChange={async (date, type) => {
                                                if (type === 'END_DATE') {
                                                    // Only proceed if we have a valid date
                                                    if (!date) {
                                                        setEndDate(null);
                                                        setContextEndDate(null);
                                                        setTripLength(null);
                                                        return;
                                                    }

                                                    // Use the ref to get the latest start date value
                                                    const currentStartDate = startDateRef.current;

                                                    if (currentStartDate) {
                                                        // Calculate time difference in milliseconds
                                                        const timeDiff = date.getTime() - currentStartDate.getTime();

                                                        // Check if the selected end date is before the start date
                                                        if (timeDiff < 0) {
                                                            // Swap: the earlier date becomes start, later becomes end
                                                            const newStartDate = date;
                                                            const newEndDate = currentStartDate;

                                                            // Recalculate trip length with swapped dates (inclusive of both start and end dates)
                                                            const swappedTimeDiff = newEndDate.getTime() - newStartDate.getTime();
                                                            const swappedDays = Math.floor(swappedTimeDiff / (1000 * 60 * 60 * 24)) + 1;

                                                            // Update ref, local state, and context together
                                                            startDateRef.current = newStartDate;
                                                            setStartDate(newStartDate);
                                                            setContextStartDate(newStartDate.toISOString());
                                                            setEndDate(newEndDate);
                                                            setContextEndDate(newEndDate.toISOString());
                                                            setTripLength(swappedDays);
                                                        } else {
                                                            // Normal forward selection - end date is after start date
                                                            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;

                                                            setEndDate(date);
                                                            setContextEndDate(date.toISOString());
                                                            setTripLength(days);
                                                        }

                                                        // Save trip to database after dates are selected
                                                        try {
                                                            await saveTrip();
                                                        } catch (error) {
                                                            console.error('[create_trip_1_city] Error saving trip after date selection:', error);
                                                        }
                                                    }
                                                } else {
                                                    // Clear end date and trip length when selecting a new start date
                                                    startDateRef.current = date;
                                                    setStartDate(date);
                                                    setContextStartDate(date.toISOString());
                                                    setEndDate(null);
                                                    setContextEndDate(null);
                                                    setTripLength(null);
                                                }
                                            }}
                                                width={350}
                                                textStyle={{
                                                    fontFamily: 'outfit',
                                                    fontSize: 16,
                                                }}
                                                monthTitleStyle={{
                                                    fontFamily: 'outfit-bold',
                                                    fontSize: 24,
                                                    color: '#1a1a1a',
                                                }}
                                                yearTitleStyle={{
                                                    fontFamily: 'outfit-bold',
                                                    fontSize: 24,
                                                    color: '#1a1a1a',
                                                }}
                                                dayLabelsWrapper={{
                                                    borderTopWidth: 0,
                                                    borderBottomWidth: 0,
                                                }}
                                                previousComponent={
                                                    <Ionicons name="chevron-back" size={24} color="#666666" />
                                                }
                                                nextComponent={
                                                    <Ionicons name="chevron-forward" size={24} color="#666666" />
                                                }
                                            />
                                        </View>
                                    ) : (
                                        // Flexible Days Dropdown
                                        <View style={styles.flexibleDaysContainer}>
                            <View style={styles.dropdownContainer}>
                                <TouchableOpacity
                                    style={styles.dropdownButton}
                                    onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    <View style={styles.dropdownContent}>
                                        <MaterialCommunityIcons name="calendar-clock-outline" size={24} color="black" />
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
                                                    style={[
                                                        styles.option,
                                                        tripLength === day && styles.selectedOption
                                                    ]}
                                                    onPress={async () => {
                                                        setTripLength(day);
                                                        setIsDropdownOpen(false);

                                                        // Save trip to database after selecting flexible days
                                                        try {
                                                            await saveTrip();
                                                        } catch (error) {
                                                            console.error('[create_trip_1_city] Error saving trip after flexible days selection:', error);
                                                        }
                                                    }}
                                                >
                                                    <Text style={[
                                                        styles.optionText,
                                                        tripLength === day && styles.selectedOptionText
                                                    ]}>
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

                                    {/* Confirm Button */}
                                    <TouchableOpacity
                                        style={[
                                            styles.confirmButton,
                                            { opacity: tripLength ? 1 : 0.3 }
                                        ]}
                                        onPress={() => {
                                            // tripLength is already set in both modes, just close the modal
                                            if (tripLength) {
                                                setIsCalendarOpen(false);
                                            }
                                        }}
                                        disabled={!tripLength}
                                    >
                                        <Text style={styles.confirmButtonText}>Confirm</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Modal>

                        {/* Trip Visibility Toggle - shown after trip length is selected */}
                        {tripLength && (
                            <View style={styles.visibilitySection}>
                                <View style={styles.visibilityToggleContainer}>
                                    <View style={styles.visibilityTextContainer}>
                                        <Text style={styles.visibilityTitle}>Visible on profile</Text>
                                        <Text style={styles.visibilityDescription}>Let friends see this trip on your profile</Text>
                                    </View>
                                    <Switch
                                        value={isVisibleOnProfile}
                                        onValueChange={(value) => {
                                            setIsVisibleOnProfile(value);
                                        }}
                                        trackColor={{ false: '#D1D5DB', true: '#FFA53F' }}
                                        thumbColor={isVisibleOnProfile ? '#FFFFFF' : '#f4f3f4'}
                                        ios_backgroundColor="#D1D5DB"
                                    />
                                </View>
                            </View>
                        )}

                        {/* Invite Tripmate Button - shown after trip length is selected */}
                        {tripLength && (
                            <View style={{ marginTop: 15 }}>
                                <TouchableOpacity
                                    style={[
                                        styles.inviteTripmateButton,
                                        isSavingTrip && styles.inviteTripmateButtonDisabled
                                    ]}
                                    onPress={handleInviteTripmate}
                                    disabled={isSavingTrip}
                                >
                                    <View style={styles.inviteTripmateContent}>
                                        {isSavingTrip ? (
                                            <>
                                                <ActivityIndicator size="small" color="#666" />
                                                <Text style={styles.inviteTripmateText}>Loading...</Text>
                                            </>
                                        ) : (
                                            <>
                                                <MaterialIcons name="person-add" size={24} color="#666" />
                                                <View style={styles.inviteTripmateTextContainer}>
                                                    <Text style={styles.inviteTripmateText}>Invite tripmates</Text>
                                                    <Text style={styles.inviteTripmateOptional}>Optional</Text>
                                                </View>
                                            </>
                                        )}
                                    </View>
                                </TouchableOpacity>

                                {/* Invited Tripmates Display */}
                                {collaborators && collaborators.filter(c => c.role !== 'owner').length > 0 && (
                                    <View style={styles.invitedTripmatesContainer}>
                                        {collaborators
                                            .filter(c => c.role !== 'owner')
                                            .map((collaborator, index) => (
                                                <View key={collaborator.username || index} style={styles.tripmateChip}>
                                                    <Text style={styles.tripmateUsername}>@{collaborator.username}</Text>
                                                    <TouchableOpacity
                                                        onPress={async () => {
                                                            // Remove collaborator
                                                            try {
                                                                const { API } = await import('aws-amplify');
                                                                const { removeCollaborator } = await import('../../src/graphql/mutations');

                                                                const result = await API.graphql({
                                                                    query: removeCollaborator,
                                                                    variables: {
                                                                        tripId,
                                                                        username: collaborator.username
                                                                    }
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
                                                        <Ionicons name="close" size={16} color="#666" />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* Next Button */}
                <View style={styles.nextButtonContainer}>
                    <TouchableOpacity
                        onPress={handleNext}
                        style={[
                            styles.nextButton,
                            { opacity: (selectedCity && hasSelectedPlace && tripLength) ? 1 : 0 }
                        ]}
                        disabled={!selectedCity || !hasSelectedPlace || !tripLength}
                    >
                        <Text style={styles.nextButtonText}>Next</Text>
                    </TouchableOpacity>
                </View>
                </View>
            </TouchableWithoutFeedback>

            {/* Share Trip Modal */}
            {currentUserID && tripId && (
                <ShareTripModal
                    visible={isShareModalVisible}
                    onClose={() => setIsShareModalVisible(false)}
                    tripId={tripId}
                    collaborators={collaborators || []}
                    currentUserRole="owner"
                    currentUserID={currentUserID}
                    selectedCity={selectedCity}
                    onCollaboratorsUpdate={handleCollaboratorsUpdate}
                />
            )}
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    label: {
        fontFamily: 'outfit-medium',
        fontSize: 18,
        marginTop: 7,
        marginBottom: 10,
        color: '#1a1a1a'
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
    },
    backButton: {
        marginRight: 15,
    },
    promptSection: {
        paddingHorizontal: 20,
        paddingVertical: 25,
        alignItems: 'left',
      },
      promptTitleCity: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        color: '#1a1a1a',
        textAlign: 'left',
        marginTop: 80,
        marginLeft: -20,
        marginBottom: 8,
      },
      promptTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        color: '#1a1a1a',
        textAlign: 'left',
        marginLeft: -20,
        marginBottom: 8,
      },
    tripLengthSection: {
        marginTop: 20,
    },
    dropdownContainer: {
        position: 'relative',
        zIndex: 1000,
    },
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderWidth: 0,
        borderRadius: 20,
        backgroundColor: 'white',
        height: 55,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    dropdownButtonText: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#1a1a1a',
    },
    dropdownArrow: {
        fontFamily: 'outfit',
        fontSize: 12,
        color: '#666',
        transform: [{ rotate: '0deg' }],
    },
    dropdownArrowOpen: {
        transform: [{ rotate: '180deg' }],
    },
    dropdownList: {
        position: 'absolute',
        top: 65,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderWidth: 0,
        borderRadius: 20,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        zIndex: 1001,
    },
    optionsList: {
        maxHeight: 200,
    },
    option: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    selectedOption: {
        backgroundColor: Colors.PRIMARY + '20',
    },
    optionText: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#1a1a1a',
        textAlign: 'center',
    },
    selectedOptionText: {
        fontFamily: 'outfit-bold',
        color: Colors.PRIMARY,
    },
    searchContainer: {
        position: 'relative',
        marginTop: -15,
    },
    searchIconInsideContainer: {
        position: 'absolute',
        left: 15,
        top: 15,
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: 24,
        width: 24,
    },
    dropdownContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    placeholderText: {
        color: '#999999',
    },
    nextButtonContainer: {
        position: 'absolute',
        bottom: 50,
        left: 25,
        right: 25,
    },
    nextButton: {
        padding: 15,
        backgroundColor: '#F36406',
        borderRadius: 15,
    },
    nextButtonText: {
        color: Colors.WHITE,
        textAlign: 'center',
        fontFamily: 'outfit-bold',
        fontSize: 17,
    },
    // Calendar Button Styles
    calendarButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderWidth: 0,
        borderRadius: 20,
        backgroundColor: 'white',
        height: 55,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    calendarButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    calendarButtonText: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#1a1a1a',
    },
    // Calendar Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '80%',
    },
    modalHandleContainer: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#D1D5DB',
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
        color: '#666666',
    },
    modalTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        color: '#1a1a1a',
        textAlign: 'left',
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
        borderRadius: 25,
        paddingVertical: 16,
        marginTop: 35,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontFamily: 'outfit-bold',
        fontSize: 18,
    },
    instructionContainer: {
        marginTop: 20,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    instructionText: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#F36406',
        textAlign: 'center',
    },
    inviteTripmateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        padding: 15,
        borderWidth: 0,
        borderRadius: 20,
        backgroundColor: 'white',
        minHeight: 55,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    inviteTripmateContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    inviteTripmateTextContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inviteTripmateText: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#1a1a1a',
    },
    inviteTripmateOptional: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#999999',
        fontStyle: 'italic',
    },
    inviteTripmateButtonDisabled: {
        opacity: 0.6,
    },
    invitedTripmatesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
        gap: 8,
    },
    tripmateChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e9ecef',
        borderRadius: 20,
        paddingVertical: 6,
        paddingLeft: 12,
        paddingRight: 8,
        gap: 6,
    },
    tripmateUsername: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#333',
    },
    tripmateRemoveButton: {
        padding: 2,
    },
    visibilitySection: {
        marginTop: 20,
    },
    visibilityToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderRadius: 20,
        backgroundColor: 'white',
        minHeight: 55,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    visibilityTextContainer: {
        flex: 1,
        marginRight: 10,
    },
    visibilityTitle: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#1a1a1a',
    },
    visibilityDescription: {
        fontFamily: 'outfit',
        fontSize: 13,
        color: '#999999',
        marginTop: 2,
    },
})
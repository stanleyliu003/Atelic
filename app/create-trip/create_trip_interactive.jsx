import { Colors } from '../../constants/Colors';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';
import { WishlistActivities } from '../../src/components/trip-view/wishlist_activities';
import { ActivityDetailView } from '../../src/components/trip-view/description_card';

export default function create_trip_interactive() {
    const router = useRouter();
    const navigation = useNavigation();
    const {
        setIsCreatingTrip,
        cityCategories,
        selectedCategories,
        setSelectedCategories,
        categoryActivities,
        selectedActivityIds,
        loadingCategories,
        generateActivitiesForCategory,
        toggleActivitySelection,
        getSelectedActivities,
        updateActivities
    } = useCreateTrip();

    const { selectedCity, tripLength } = useCreateTrip();

    // State for activity detail view
    const [selectedActivityForDetail, setSelectedActivityForDetail] = useState(null);
    const [showActivityDetail, setShowActivityDetail] = useState(false);
    
    // State for scroll indicator
    const [scrollPosition, setScrollPosition] = useState(0);

    useEffect(() => {
        navigation.setOptions({
            headerShown: false
        })
        
        // Set flag that user is creating a trip
        setIsCreatingTrip(true);
        
        // Cleanup when component unmounts
        return () => {
            setIsCreatingTrip(false);
        };
    }, [])

    // Handle category selection
    const handleCategorySelect = async (categoryName) => {
        if (selectedCategories.includes(categoryName)) {
            // Deselect category
            setSelectedCategories(prev => prev.filter(cat => cat !== categoryName));
        } else {
            // Select category
            setSelectedCategories(prev => [...prev, categoryName]);

            // Generate activities for newly selected category if not already generated
            if (!categoryActivities[categoryName] || categoryActivities[categoryName].length === 0) {
                try {
                    await generateActivitiesForCategory(categoryName);
                } catch (error) {
                    console.error('Error generating activities for category:', categoryName, error);
                }
            }
        }
    };

    // Handle generating more activities for a category
    const handleGenerateMoreActivities = async (categoryName) => {
        try {
            await generateActivitiesForCategory(categoryName);
        } catch (error) {
            console.error('Error generating more activities for category:', categoryName, error);
        }
    };

    // Handler for activity description card selection
    const handleActivityDescriptionCardSelect = (activity) => {
        setSelectedActivityForDetail(activity);
        setShowActivityDetail(true);
    };

    // Handler for closing activity detail view
    const handleCloseActivityDetail = () => {
        setShowActivityDetail(false);
        setSelectedActivityForDetail(null);
    };

    // Handler for Load Wishlist button
    const handleLoadWishlist = () => {
        // Get all selected activities and pass them to the context
        const selectedActivities = getSelectedActivities();
        updateActivities(selectedActivities);
        
        // Navigate to trip-view_main
        router.replace('/trip-view/trip-view_main');
    };

    // Handler for scroll events to update indicator
    const handleScroll = (event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const scrollX = contentOffset.x;
        const totalWidth = contentSize.width - layoutMeasurement.width;
        
        // Calculate which dot should be active based on scroll position
        let activeDot = 0;
        if (totalWidth > 0) {
            const scrollPercentage = scrollX / totalWidth;
            if (scrollPercentage < 0.33) {
                activeDot = 0;
            } else if (scrollPercentage < 0.66) {
                activeDot = 1;
            } else {
                activeDot = 2;
            }
        }
        
        setScrollPosition(activeDot);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: Colors.WHITE }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={60}
        >
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                style={{ backgroundColor: Colors.WHITE }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{
                    padding: 25,
                    paddingTop: 40,
                    backgroundColor: Colors.WHITE,
                    minHeight: '100%'
                }}>
                    {/* Header Row */}
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.replace('/create-trip/create_trip_1_city')} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={32} color="black" />
                        </TouchableOpacity>
                    </View>

                    {/* Categories Prompt */}
                    <View style={styles.promptSection}>                    
                        <Text style={styles.promptTitle}>Create your {selectedCity} wishlist</Text>
                        <Text style={styles.promptSubtitle}>Select your interests</Text>
                    </View>

                    {/* City Categories Display */}
                    {cityCategories && cityCategories.length > 0 ? (
                        <View style={styles.categoriesSection}>
                            <ScrollView
                                horizontal={true}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.categoriesHorizontalContainer}
                                style={styles.categoriesScrollView}
                                onScroll={handleScroll}
                                scrollEventThrottle={16}
                            >
                                {cityCategories.map((category, index) => {
                                    const isSelected = selectedCategories.includes(category.category);
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.categoryCard,
                                                isSelected && styles.selectedCategoryCard
                                            ]}
                                            onPress={() => handleCategorySelect(category.category)}
                                            activeOpacity={0.7}
                                        >
                                            {/* Selection indicator */}
                                            <View style={[styles.selectionIndicator, isSelected && styles.selectedIndicator]}>
                                                {isSelected && <Text style={styles.checkmark}>✓</Text>}
                                            </View>
                                            <View style={styles.categoryContent}>
                                                {category.emoji && (
                                                    <View style={[styles.emojiContainer, isSelected && styles.selectedEmojiContainer]}>
                                                        <Text style={styles.categoryEmoji}>
                                                            {category.emoji}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={[styles.categoryName, isSelected && styles.selectedCategoryName]}>
                                                    {category.category}
                                                </Text>
                                                <Text style={[styles.categoryItems, isSelected && styles.selectedCategoryItems]}>
                                                    {category.category_items[0]}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                            
                            {/* Custom Horizontal Scroll Indicator */}
                            <View style={styles.scrollIndicatorContainer}>
                                <View style={styles.scrollIndicator}>
                                    <View style={[
                                        styles.scrollIndicatorDot, 
                                        scrollPosition === 0 && styles.activeDot
                                    ]} />
                                    <View style={[
                                        styles.scrollIndicatorDot, 
                                        scrollPosition === 1 && styles.activeDot
                                    ]} />
                                    <View style={[
                                        styles.scrollIndicatorDot, 
                                        scrollPosition === 2 && styles.activeDot
                                    ]} />
                                </View>
                            </View>
                        </View>
                    ) : selectedCity && (
                        <View style={styles.categoriesSection}>
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={Colors.PRIMARY} />
                                <Text style={styles.loadingText}>Loading experiences in {selectedCity}...</Text>
                            </View>
                        </View>
                    )}

                    {/* Selected Category Activities Display */}
                    {selectedCategories.length > 0 && (
                        <View style={styles.selectedCategoriesActivitiesSection}>
                            {selectedCategories.map((categoryName) => {
                                const activities = categoryActivities[categoryName] || [];
                                const isLoading = loadingCategories[categoryName] || false;

                                return (
                                    <View key={categoryName} style={styles.categoryActivitiesContainer}>
                                        {/* Category Name Subtitle */}
                                        <Text style={styles.categorySubtitle}>{categoryName}</Text>

                                        {/* Loading State - Only show when no activities exist yet (initial load) */}
                                        {isLoading && activities.length === 0 && (
                                            <View style={styles.categoryLoadingContainer}>
                                                <ActivityIndicator size="small" color={Colors.PRIMARY} />
                                                <Text style={styles.categoryLoadingText}>
                                                    Generating {categoryName.toLowerCase()} activities...
                                                </Text>
                                            </View>
                                        )}

                                        {/* Activity Cards - Always show if activities exist */}
                                        {activities.length > 0 && (
                                            <View style={styles.activityCardsContainer}>
                                                <WishlistActivities
                                                    activities={activities}
                                                    selectedActivities={selectedActivityIds}
                                                    onActivitySelect={toggleActivitySelection}
                                                    onActivityDeselect={toggleActivitySelection}
                                                    onDescriptionCardPress={handleActivityDescriptionCardSelect}
                                                    showSelectionIndicator={true}
                                                />
                                            </View>
                                        )}

                                        {/* Generate More Button */}
                                        {activities.length > 0 && (
                                            <TouchableOpacity
                                                style={[styles.generateMoreButton, isLoading && styles.generateMoreButtonDisabled]}
                                                onPress={() => !isLoading && handleGenerateMoreActivities(categoryName)}
                                                disabled={isLoading}
                                            >
                                                {isLoading ? (
                                                    <ActivityIndicator size="small" color="#666" />
                                                ) : (
                                                    <Feather name="plus-circle" size={24} color="black" />
                                                )}
                                                <Text style={[styles.generateMoreButtonText, isLoading && styles.generateMoreButtonTextDisabled]}>
                                                    {isLoading ? 'Loading...' : `More ${categoryName.toLowerCase()}`}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                    
                    {/* Load Wishlist Button - Only show when user has selected activities */}
                    {selectedActivityIds.length > 0 && (
                        <View style={styles.loadWishlistButtonContainer}>
                            <TouchableOpacity
                                onPress={handleLoadWishlist}
                                style={styles.loadWishlistButton}
                            >
                                <Text style={styles.loadWishlistButtonText}>
                                    Load Wishlist
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Activity Detail View Overlay */}
            {showActivityDetail && selectedActivityForDetail && (
                <View style={styles.activityDetailOverlay}>
                    <TouchableOpacity
                        style={styles.overlayBackground}
                        onPress={handleCloseActivityDetail}
                        activeOpacity={1}
                    />
                    <View style={styles.bottomPopup}>
                        <ActivityDetailView
                            activity={selectedActivityForDetail}
                            onClose={handleCloseActivityDetail}
                            variant="wishlist"
                        />
                    </View>
                </View>
            )}
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    promptSection: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        alignItems: 'flex-start',
      },
      promptTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 28,
        color: '#1a1a1a',
        textAlign: 'left',
        marginBottom: 26,
      },
      promptSubtitle: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#666',
        textAlign: 'left',
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
    categoriesSection: {
        marginTop: -8,
        marginBottom: 20,
        paddingBottom: 0, // Add extra padding so users can scroll to see bottom categories above the fixed button
    },
    categoriesTitle: {
        fontFamily: 'outfit-medium',
        fontSize: 18,
        color: '#1a1a1a',
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        paddingHorizontal: 5,
        marginTop: 15,
    },
    categoriesScrollView: {
        paddingVertical: 10,
    },
    scrollIndicatorContainer: {
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 5,
    },
    scrollIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    scrollIndicatorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ccc',
    },
    activeDot: {
        backgroundColor: '#007AFF',
    },
    categoriesHorizontalContainer: {
        paddingHorizontal: 20,
        paddingRight: 40,
    },
    categoryCard: {
        width: 145,
        height: 125,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 10,
        marginRight: 15,
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
    selectedCategoryCard: {
        backgroundColor: '#f0f8ff', // Light blue background for selected state
        borderColor: Colors.PRIMARY,
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
        lineHeight: 12,
        textAlign: 'center',
    },
    selectionIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 15,
        height: 15,
        borderRadius: 7.5,
        borderColor: Colors.GRAY,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        zIndex: 1,
    },
    selectedIndicator: {
        backgroundColor: Colors.PRIMARY,
        borderColor: Colors.PRIMARY,
    },
    checkmark: {
        color: 'white',
        fontSize: 9.375,
        fontWeight: 'bold',
    },
    categoryContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiContainer: {
        width: 45,
        height: 45,
        borderRadius: 25,
        backgroundColor: '#e9ecef',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    selectedEmojiContainer: {
        backgroundColor: '#333',
    },
    categoryEmoji: {
        fontSize: 24,
        textAlign: 'center',
    },
    selectedCategoryName: {
        color: Colors.PRIMARY,
    },
    selectedCategoryItems: {
        color: Colors.PRIMARY,
    },
    loadWishlistButtonContainer: {
        marginTop: 30,
        marginBottom: 20,
        paddingHorizontal: 5,
    },
    loadWishlistButton: {
        padding: 20,
        backgroundColor: Colors.PRIMARY,
        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    loadWishlistButtonText: {
        color: Colors.WHITE,
        textAlign: 'center',
        fontFamily: 'outfit-bold',
        fontSize: 16,
    },
    // Selected Category Activities Styles
    selectedCategoriesActivitiesSection: {
        marginTop: 20, // Reduced by 50px (from 20 to -30)
        paddingHorizontal: 0,
    },
    categoryActivitiesContainer: {
        marginBottom: 30,
    },
    categorySubtitle: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        color: '#1a1a1a',
        marginBottom: 15,
        paddingHorizontal: 5,
        textAlign: 'center',
    },
    categoryLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    categoryLoadingText: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#666',
        marginLeft: 10,
    },
    activityCardsContainer: {
        marginBottom: 15,
    },
    generateMoreButton: {
        marginTop: -30,
        backgroundColor: 'white',
        borderRadius: 15,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginHorizontal: 5,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    generateMoreButtonText: {
        fontFamily: 'outfit',
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '500',
    },
    generateMoreButtonDisabled: {
        opacity: 0.6,
    },
    generateMoreButtonTextDisabled: {
        color: '#666',
    },
    // Activity Detail Modal Styles
    activityDetailOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        justifyContent: 'flex-end',
    },
    overlayBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomPopup: {
        height: '67%',
        backgroundColor: Colors.WHITE,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        paddingTop: 25,
    },
})
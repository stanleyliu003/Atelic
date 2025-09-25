import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';

export default function create_trip_interactive() {
    const router = useRouter();
    const navigation = useNavigation();
    const { setIsCreatingTrip, cityCategories, selectedCategories, setSelectedCategories } = useCreateTrip();

    const { selectedCity, tripLength } = useCreateTrip();

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
    const handleCategorySelect = (categoryName) => {
        if (selectedCategories.includes(categoryName)) {
            // Deselect category
            setSelectedCategories(prev => prev.filter(cat => cat !== categoryName));
        } else {
            // Select category
            setSelectedCategories(prev => [...prev, categoryName]);
        }
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
                                showsHorizontalScrollIndicator={true}
                                contentContainerStyle={styles.categoriesHorizontalContainer}
                                style={styles.categoriesScrollView}
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
                        </View>
                    ) : selectedCity && (
                        <View style={styles.categoriesSection}>
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={Colors.PRIMARY} />
                                <Text style={styles.loadingText}>Loading experiences in {selectedCity}...</Text>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>
            
            {/* Fixed Next Button - Always visible at bottom */}
            {cityCategories && cityCategories.length > 0 && (
                <View style={styles.fixedButtonContainer}>
                    <TouchableOpacity
                        onPress={() => router.replace('/create-trip/create_trip_4_additional_info')}
                        style={styles.fixedNextButton}
                    >
                        <Text style={styles.nextButtonText}>Jesus is Lord! Next</Text>
                    </TouchableOpacity>
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
        paddingBottom: 100, // Add extra padding so users can scroll to see bottom categories above the fixed button
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
    nextButton: {
        padding: 20,
        backgroundColor: Colors.PRIMARY,
        borderRadius: 15,
        marginTop: 30,
    },
    fixedButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // Semi-transparent white background
        paddingHorizontal: 25,
        paddingTop: 15,
        paddingBottom: 40, // Extra padding for safe area
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    fixedNextButton: {
        padding: 20,
        backgroundColor: Colors.PRIMARY,
        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    nextButtonText: {
        color: Colors.WHITE,
        textAlign: 'center',
        fontFamily: 'outfit-bold',
        fontSize: 16,
    }
})
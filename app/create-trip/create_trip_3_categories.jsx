import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';

export default function create_trip_3_categories() {
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
                        <TouchableOpacity onPress={() => router.replace('/create-trip/create_trip_2_length')} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={32} color="black" />
                        </TouchableOpacity>
                        <Text style={styles.titleText}>Plan Your Trip</Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressSection}>
                        <View style={styles.progressTrack}>
                            <View style={styles.progressFill3}></View>
                        </View>
                        <Text style={styles.progressLabel}>Step 3 of 4</Text>
                    </View>
                    {/* Categories Prompt */}
                    <View style={styles.promptSection}>                    
                        <Text style={styles.promptTitle}>What kind of experiences in {selectedCity} interest you?</Text>
                        <Text style={styles.promptSubtitle}>Select all that apply</Text>
                    </View>

                    {/* City Categories Display */}
                    {cityCategories && cityCategories.length > 0 ? (
                        <View style={styles.categoriesSection}>
                            <View style={styles.categoriesGrid}>
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
                            </View>
                        </View>
                    ) : selectedCity && (
                        <View style={styles.categoriesSection}>
                            <Text style={styles.categoriesTitle}>Getting inspiration for {selectedCity}...</Text>
                        </View>
                    )}
                
                    {/* Next Button */}
                    <View> 
                        <TouchableOpacity
                            onPress={() => router.replace('/create-trip/create_trip_4_additional_info')}
                            style={{
                                padding: 20,
                                backgroundColor: Colors.PRIMARY,
                                borderRadius: 15,
                                marginTop: 50
                            }}
                        >
                            <Text style={{
                                color: Colors.WHITE,
                                textAlign: 'center',
                                fontFamily: 'outfit-bold',
                            }}>Next</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    progressSection: {
        padding: 20,
        backgroundColor: 'white',
    },
    progressTrack: {
        height: 6,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
    },
    progressFill3: {
        height: '100%',
        width: '75%',
        backgroundColor: '#333',
        borderRadius: 3,
    },
    progressLabel: {
        marginTop: 10,
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
        fontFamily: 'outfit-medium',
    },
    promptSection: {
        paddingHorizontal: 20,
        paddingVertical: 25,
        alignItems: 'center',
      },
      promptTitle: {
        fontFamily: 'outfit-bold',
        fontSize: 24,
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 8,
      },
      promptSubtitle: {
        fontFamily: 'outfit',
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
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
    titleText: {
        fontFamily: 'outfit-bold',
        fontSize: 32,
        color: '#1a1a1a',
        flex: 1,
    },
    categoriesSection: {
        marginTop: 10,
        marginBottom: 20,
    },
    categoriesTitle: {
        fontFamily: 'outfit-medium',
        fontSize: 18,
        color: '#1a1a1a',
        marginBottom: 15,
        paddingHorizontal: 5,
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
        lineHeight: 16,
        textAlign: 'center',
    },
    selectionIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 10,
        height: 10,
        borderRadius: 5,
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
        fontSize: 6.25,
        fontWeight: 'bold',
    },
    categoryContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedCategoryName: {
        color: Colors.PRIMARY,
    },
    selectedCategoryItems: {
        color: Colors.PRIMARY,
    }
})
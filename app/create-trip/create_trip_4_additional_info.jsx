import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';

export default function create_trip_4_additional_info() {
    const router = useRouter();
    const navigation = useNavigation();
    const { updateWishlistText, setIsCreatingTrip, selectedCategories } = useCreateTrip();
    const [wishlist_text_raw, setWishlistText] = useState();

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

    const OnWishListInput = async () => {
        // Check if user has either selected categories or inputted wishlist text
        if (!wishlist_text_raw && (!selectedCategories || selectedCategories.length === 0)) {
            return;
        }
        
        // Store the raw wishlist text in context before navigating
        updateWishlistText(wishlist_text_raw || '');
        
        // Navigate to loading page which will handle the API call
        router.replace('/create-trip/loadingWishlist');
    }

    const handleCreateWishlist = () => {
        OnWishListInput();
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
                        <TouchableOpacity onPress={() => router.replace('/create-trip/create_trip_3_categories')} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={32} color="black" />
                        </TouchableOpacity>
                        <Text style={styles.titleText}>Plan Your Trip</Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressSection}>
                        <View style={styles.progressTrack}>
                            <View style={styles.progressFill4}></View>
                        </View>
                        <Text style={styles.progressLabel}>Step 4 of 4</Text>
                    </View>

                    {/* Additional Info Prompt */}
                    <View style={styles.promptSection}>                    
                        <Text style={styles.promptTitle}>Any additional preferences for your trip?</Text>
                        <Text style={styles.promptSubtitle}>Share specific interests, experiences, activities you'd like to include (optional)</Text>
                    </View>

                    {/* Enter Destinations */}
                    <View style={{
                        marginTop: 25
                    }}>
                        <TextInput 
                            style={styles.input}
                            placeholder='Ex: Vegan friendly restaurants, coastal hiking trails, jazz bars'
                            onChangeText={(value) => setWishlistText(value)}
                            multiline={true}
                        />
                    </View>
                
                    {/* Create Wishlist Button */}
                    <View> 
                        <TouchableOpacity
                            onPress={handleCreateWishlist}
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
                            }}>Create Wishlist</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    input: {
        marginTop: 10,
        padding: 15,
        borderWidth: 1,
        borderRadius: 30,
        borderColor: '#1a1a1a',
        fontFamily: 'outfit',
        height: 250,
        textAlignVertical: 'top',
        paddingTop: 15,
        color: '#1a1a1a'
    },
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
    progressFill4: {
        height: '100%',
        width: '100%',
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
})

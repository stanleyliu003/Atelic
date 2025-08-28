import { Colors } from '../../constants/Colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCreateTrip } from '../../context/CreateTripContext';

export default function create_trip_2_length() {
    const router = useRouter();
    const navigation = useNavigation();
    const { setIsCreatingTrip, tripLength, setTripLength } = useCreateTrip();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

    const handleNext = () => {
        if (!tripLength) {
            return;
        }
        router.push('/create-trip/create_trip_3_categories');
    };

    const dayOptions = Array.from({ length: 14 }, (_, i) => i + 1);

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: Colors.WHITE }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={60}
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
                    <Text style={styles.titleText}>Plan Your Trip</Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressSection}>
                    <View style={styles.progressTrack}>
                        <View style={styles.progressFill2}></View>
                    </View>
                                            <Text style={styles.progressLabel}>Step 2 of 4</Text>
                </View>

                {/* Trip Length Prompt */}
                    <View style={styles.promptSection}>                    
                    <Text style={styles.promptTitle}>How long is your trip?</Text>
                    <Text style={styles.promptSubtitle}>Select the number of days</Text>
                </View>

                {/* Trip Length Selection */}
                <View style={{
                    marginTop: 15
                }}>
                    
                    <View style={styles.dropdownContainer}>
                        <TouchableOpacity 
                            style={styles.dropdownButton}
                            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <Text style={styles.dropdownButtonText}>
                                {tripLength ? `${tripLength} day${tripLength > 1 ? 's' : ''}` : 'Select number of days'}
                            </Text>
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
                                            onPress={() => {
                                                setTripLength(day);
                                                setIsDropdownOpen(false);
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
                
                {/* Next Button */}
                <View style={{ position: 'absolute', bottom: 50, left: 25, right: 25 }}>
                    <TouchableOpacity
                        onPress={handleNext}
                        style={{
                            padding: 20,
                            backgroundColor: tripLength ? Colors.PRIMARY : Colors.GRAY,
                            opacity: tripLength ? 1 : 0.6,
                            borderRadius: 15,
                        }}
                        disabled={!tripLength}
                    >
                        <Text style={{
                            color: Colors.WHITE,
                            textAlign: 'center',
                            fontFamily: 'outfit-bold',
                        }}>Next</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
    dropdownContainer: {
        position: 'relative',
        zIndex: 1000,
    },
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderWidth: 1,
        borderRadius: 15,
        borderColor: '#1a1a1a',
        backgroundColor: 'white',
        height: 50,
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
        top: 55,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#1a1a1a',
        borderRadius: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
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
    progressFill2: {
        height: '100%',
        width: '50%',
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
    }
})
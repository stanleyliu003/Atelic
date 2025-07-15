import { Colors } from '../../constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Auth } from 'aws-amplify';
import { useEffect, useState } from 'react';

export default function Profile() {
  const params = useLocalSearchParams();
  const photoReference = params.photoReference || '';
  const dayCount = parseInt(params.dayCount, 10) || 1;

  const [fullName, setFullName] = useState('');

  useEffect(() => {
    Auth.currentAuthenticatedUser()
      .then(user => {
        const name = user.attributes?.name || '';
        setFullName(name);
      })
      .catch((err) => {
        setFullName('');
      });
  }, []);

  const getDayCountText = () => {
    if (dayCount === 1) return '1 day';
    return `${dayCount} day`;
  };

  const getImageUrl = (photoReference) => {
    const { GOOGLE_PLACES_API_KEY } = require('../../src/constants/api');
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
  };

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Profile</Text>
        <FontAwesome name="user-circle" size={40} color="black" />
      </View>

      {/* Welcome Back Full Name */}
      {fullName ? (
        <Text style={{
          fontFamily: 'outfit',
          fontSize: 24,
          marginTop: 30,
          color: Colors.PRIMARY
        }}>Welcome back, {fullName}!</Text>
      ) : null}

      {/* Trip Summary (if params present) */}
      {(photoReference || params.dayCount) && (
        <View style={styles.tripSummaryContainer}>
          {/* Top left quadrant image */}
          {photoReference ? (
            <Image
              source={{ uri: getImageUrl(photoReference) }}
              style={styles.tripSummaryImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.tripSummaryImagePlaceholder}>
              <FontAwesome name="user-circle" size={60} color={Colors.GRAY} />
            </View>
          )}
          <View style={styles.tripSummaryTextContainer}>
            <Text style={styles.tripSummaryText}>
              {getDayCountText()} trip to [Placeholder]
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 25,
    paddingTop: 55,
    backgroundColor: Colors.WHITE,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignContent: 'center',
    justifyContent: 'space-between',
    paddingTop: 25,
    marginBottom: 0,
  },
  headerText: {
    fontFamily: 'outfit-bold',
    fontSize: 35,
  },
  tripSummaryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 30,
    marginBottom: 30,
  },
  tripSummaryImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginRight: 20,
  },
  tripSummaryImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripSummaryTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  tripSummaryText: {
    fontFamily: 'outfit-bold',
    fontSize: 24,
    color: Colors.PRIMARY,
  },
});
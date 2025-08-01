import { Colors } from '../../../../constants/Colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface NoActivitiesProps {
  title?: string;
  subtitle?: string;
}

export function NoActivities({ 
  title = "No activities found", 
  subtitle = "Please go back and add some destinations" 
}: NoActivitiesProps) {
  return (
    <View style={styles.noActivitiesContainer}>
      <Text style={styles.noActivitiesText}>{title}</Text>
      <Text style={styles.noActivitiesSubtext}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  noActivitiesContainer: {
    marginTop: 50,
    alignItems: 'center',
    padding: 20,
  },
  noActivitiesText: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: Colors.GRAY,
    marginBottom: 10,
  },
  noActivitiesSubtext: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    textAlign: 'center',
  },
}); 
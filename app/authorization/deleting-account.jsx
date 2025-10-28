import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Colors } from '../../constants/Colors';

export default function DeletingAccount() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.WHITE,
        padding: 24,
      }}
    >
      <ActivityIndicator size="large" color={Colors.PRIMARY} />
      <Text
        style={{
          fontFamily: 'outfit',
          fontSize: 16,
          marginTop: 12,
          color: Colors.GRAY,
          textAlign: 'center',
        }}
      >
        Please wait while we delete your account...
      </Text>
    </View>
  );
}



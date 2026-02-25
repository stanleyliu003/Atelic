import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/Colors';

interface InitialsAvatarProps {
  name: string;
  profilePhotoUrl?: string | null;
  size?: number;
  fontSize?: number;
}

// Color palette for avatar backgrounds
const AVATAR_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Sky Blue
  '#96CEB4', // Sage Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Light Blue
  '#F8B500', // Orange
  '#2ECC71', // Green
];

// Generate a consistent color based on the name
const getColorForName = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

// Get initials from a name (up to 2 characters)
const getInitials = (name: string): string => {
  if (!name || name.trim().length === 0) return '?';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export function InitialsAvatar({
  name,
  profilePhotoUrl,
  size = 50,
  fontSize,
}: InitialsAvatarProps) {
  const initials = useMemo(() => getInitials(name), [name]);
  const backgroundColor = useMemo(() => getColorForName(name), [name]);
  const calculatedFontSize = fontSize || size * 0.4;

  // If there's a valid profile photo URL (must be http/https), show the image
  const isValidUrl = profilePhotoUrl && (profilePhotoUrl.startsWith('http://') || profilePhotoUrl.startsWith('https://'));
  if (isValidUrl) {
    return (
      <Image
        source={{ uri: profilePhotoUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
    );
  }

  // Otherwise, show initials
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize: calculatedFontSize,
          },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    backgroundColor: Colors.LIGHT_GRAY,
  },
  initials: {
    color: Colors.WHITE,
    fontWeight: '600',
  },
});

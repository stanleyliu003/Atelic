import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/Colors';

interface InitialsAvatarProps {
  name: string;
  profilePhotoUrl?: string | null;
  size?: number;
  fontSize?: number;
  cacheKey?: number; // Cache-busting key to force image reload
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
  cacheKey,
}: InitialsAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const backgroundColor = useMemo(() => getColorForName(name), [name]);
  const calculatedFontSize = fontSize || size * 0.4;

  // Reset error state when URL changes
  useEffect(() => {
    setImageError(false);
  }, [profilePhotoUrl]);

  // If there's a valid profile photo URL (must be http/https) and no error, show image over initials
  const isValidUrl = profilePhotoUrl && (profilePhotoUrl.startsWith('http://') || profilePhotoUrl.startsWith('https://'));

  // Always show initials as base layer, with image on top if available
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
      {isValidUrl && !imageError && (
        <Image
          key={cacheKey || profilePhotoUrl}
          source={{
            uri: profilePhotoUrl,
            cache: 'reload' as const,
          }}
          style={[
            styles.imageOverlay,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          onError={() => setImageError(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  initials: {
    color: Colors.WHITE,
    fontWeight: '600',
  },
});

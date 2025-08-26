import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { GOOGLE_PLACES_API_KEY } from '../../../constants/api';

interface ActivityImageProps {
    photo_reference: string;
    style: any;
}

export function ActivityImage({ photo_reference, style }: ActivityImageProps) {
    const [imageError, setImageError] = useState(false);
    
    // Don't display anything if no photo reference
    if (!photo_reference) {
      return null;
    }
    
    // Show error message only if image failed to load
    if (imageError) {
      return (
        <View style={[style, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}> 
          <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
            Image\nUnavailable
          </Text>
        </View>
      );
    }
    
    const imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
    
    return (
      <Image
        style={style}
        source={{ uri: imageUrl }}
        onError={() => setImageError(true)}
        onLoad={() => {}}
      />
    );
} 
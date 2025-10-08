import { Colors } from '../../../../constants/Colors';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

interface NoActivitiesProps {
  onActionPress?: () => void;
  actionButtonText?: string;
}

export function NoActivities({
  onActionPress,
  actionButtonText = "Add Activities to Wishlist"
}: NoActivitiesProps) {
  return (
    <View style={styles.noActivitiesContainer}>
      {onActionPress && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onActionPress}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>{actionButtonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noActivitiesContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  actionButton: {
    backgroundColor: Colors.PRIMARY,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: Colors.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
}); 
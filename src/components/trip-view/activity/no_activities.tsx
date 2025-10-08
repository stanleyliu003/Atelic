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
    backgroundColor: '#F36406',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    minWidth: 200,
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 20,
    color: Colors.WHITE,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
}); 
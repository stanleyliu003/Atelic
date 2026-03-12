import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { Activity } from '../../types/activity.types';

interface FlightDetailModalProps {
  visible: boolean;
  activity: Activity | null;
  onClose: () => void;
  onDelete?: (activity: Activity) => void;
  onAddAnotherFlight?: () => void;
  currentUserRole?: 'owner' | 'editor' | 'viewer';
}

const formatTo12Hour = (time24: string): string => {
  if (!time24) return '--';
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr;
  const period = hour >= 12 ? 'PM' : 'AM';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${minute} ${period}`;
};

const calculateDuration = (startTime: string, endTime: string): string => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  let diffMinutes = endMinutes - startMinutes;
  if (diffMinutes < 0) diffMinutes += 24 * 60;
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const FlightDetailModal: React.FC<FlightDetailModalProps> = ({
  visible,
  activity,
  onClose,
  onDelete,
  onAddAnotherFlight,
  currentUserRole,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && gestureState.dy > 0;
      },
      onPanResponderGrant: () => {
        translateY.setOffset(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        const shouldClose = gestureState.dy > 80 || gestureState.vy > 0.5;
        if (shouldClose) {
          translateY.setValue(0);
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 120,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!activity) return null;

  // Parse flight info
  const nameMatch = activity.name?.match(/^(.+?)\s*[–-]\s*([A-Z]{3})\s*→\s*([A-Z]{3})$/);
  const flightNumber = nameMatch?.[1] || activity.name;
  const originCode = nameMatch?.[2] || '';
  const destCode = nameMatch?.[3] || '';
  const notesLines = (activity.notes || '').split('\n');
  const airlineName = notesLines[0] || '';
  const departsLine = notesLines.find(l => l.startsWith('Departs:'));
  const arrivesLine = notesLines.find(l => l.startsWith('Arrives:'));
  const originName = departsLine?.replace('Departs: ', '') || '';
  const destName = arrivesLine?.replace('Arrives: ', '') || '';
  const confirmationLine = notesLines.find(l => l.startsWith('Confirmation:'));
  const seatLine = notesLines.find(l => l.startsWith('Seat:'));
  const confirmation = confirmationLine?.replace('Confirmation: ', '') || '';
  const seat = seatLine?.replace('Seat: ', '') || '';
  const duration = activity.startTime && activity.endTime
    ? calculateDuration(activity.startTime, activity.endTime)
    : '';

  const handleDelete = () => {
    if (onDelete && activity) {
      onDelete(activity);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY }] },
          ]}
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
        >
          {/* Drag handle */}
          <View style={styles.dragHandle} {...panResponder.panHandlers}>
            <View style={styles.dragHandleLine} />
          </View>

          {/* Header: Airline + Flight Number */}
          <View style={styles.header}>
            <View style={styles.airlineIcon}>
              <Ionicons name="airplane" size={18} color="#FFF" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.airlineName}>{airlineName}</Text>
              <Text style={styles.flightNumber}>{flightNumber}</Text>
            </View>
            {duration ? (
              <View style={styles.durationPill}>
                <MaterialIcons name="access-time" size={13} color="#F36406" />
                <Text style={styles.durationText}>{duration}</Text>
              </View>
            ) : null}
          </View>

          {/* Route Card */}
          <View style={styles.routeCard}>
            {/* Departure */}
            <View style={styles.routeSide}>
              <Text style={styles.routeLabel}>DEPARTURE</Text>
              <Text style={styles.airportCode}>{originCode}</Text>
              <Text style={styles.routeTime}>
                {activity.startTime ? formatTo12Hour(activity.startTime) : '--'}
              </Text>
              <Text style={styles.airportName} numberOfLines={2}>{originName}</Text>
            </View>

            {/* Center line */}
            <View style={styles.routeCenter}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
              <View style={styles.planeCircle}>
                <Ionicons name="airplane" size={14} color="#F36406" style={{ transform: [{ rotate: '90deg' }] }} />
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeDot} />
            </View>

            {/* Arrival */}
            <View style={[styles.routeSide, { alignItems: 'flex-end' }]}>
              <Text style={styles.routeLabel}>ARRIVAL</Text>
              <Text style={styles.airportCode}>{destCode}</Text>
              <Text style={styles.routeTime}>
                {activity.endTime ? formatTo12Hour(activity.endTime) : '--'}
              </Text>
              <Text style={[styles.airportName, { textAlign: 'right' }]} numberOfLines={2}>{destName}</Text>
            </View>
          </View>

          {/* Info Pills */}
          {(confirmation || seat) ? (
            <View style={styles.infoPills}>
              {confirmation ? (
                <View style={styles.infoPill}>
                  <Text style={styles.infoPillLabel}>CONFIRMATION</Text>
                  <Text style={styles.infoPillValue}>{confirmation}</Text>
                </View>
              ) : null}
              {seat ? (
                <View style={styles.infoPill}>
                  <Text style={styles.infoPillLabel}>SEAT</Text>
                  <Text style={styles.infoPillValue}>{seat}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Add Another Flight Button */}
          {onAddAnotherFlight && currentUserRole !== 'viewer' && (
            <TouchableOpacity
              style={styles.addAnotherBtn}
              onPress={() => {
                onClose();
                onAddAnotherFlight();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={18} color="#F36406" />
              <Text style={styles.addAnotherBtnText}>Add Another Flight</Text>
            </TouchableOpacity>
          )}

          {/* Delete Button */}
          {onDelete && currentUserRole !== 'viewer' && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={15} color="#EF4444" />
              <Text style={styles.deleteBtnText}>Remove Flight</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  dragHandleLine: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D1D6',
    borderRadius: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 12,
  },
  airlineIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F36406',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  airlineName: {
    fontFamily: 'outfit-semibold',
    fontSize: 16,
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  flightNumber: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 1,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEE4CC',
  },
  durationText: {
    fontFamily: 'outfit-semibold',
    fontSize: 13,
    color: '#F36406',
  },

  // Route Card
  routeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 24,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  routeSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  routeLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 10,
    color: '#AEAEB2',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  airportCode: {
    fontFamily: 'outfit-bold',
    fontSize: 30,
    color: '#1C1C1E',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  routeTime: {
    fontFamily: 'outfit-semibold',
    fontSize: 14,
    color: '#F36406',
    marginTop: 4,
  },
  airportName: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
    lineHeight: 14,
  },

  // Center route line
  routeCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 32,
    gap: 3,
    flexDirection: 'row',
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D1D6',
  },
  routeLine: {
    width: 14,
    height: 1.5,
    backgroundColor: '#E5E5EA',
  },
  planeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info Pills
  infoPills: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 16,
    gap: 10,
  },
  infoPill: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoPillLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 10,
    color: '#AEAEB2',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoPillValue: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: '#1C1C1E',
  },

  // Add another flight button
  addAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 24,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFF7F0',
    borderWidth: 1,
    borderColor: '#FEE4CC',
  },
  addAnotherBtnText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#F36406',
  },

  // Delete button
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 24,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#EF4444',
  },
});

export default FlightDetailModal;

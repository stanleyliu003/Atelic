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

interface HotelDetailModalProps {
  visible: boolean;
  activity: Activity | null;
  onClose: () => void;
  onDelete?: (activity: Activity) => void;
  onEdit?: (activity: Activity) => void;
  currentUserRole?: 'owner' | 'editor' | 'viewer';
  startDate?: string;
  dayNumber?: number;
}

const formatDate = (isoString?: string): string | null => {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime12 = (time24?: string): string | null => {
  if (!time24) return null;
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return null;
  const period = hour >= 12 ? 'PM' : 'AM';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${minuteStr} ${period}`;
};

const calculateNights = (checkIn?: string, checkOut?: string): number => {
  if (!checkIn || !checkOut) return 0;
  const ci = new Date(checkIn);
  const co = new Date(checkOut);
  if (isNaN(ci.getTime()) || isNaN(co.getTime())) return 0;
  const diff = Math.round((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

const HotelDetailModal: React.FC<HotelDetailModalProps> = ({
  visible,
  activity,
  onClose,
  onDelete,
  onEdit,
  currentUserRole,
  startDate,
  dayNumber,
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

  // Extract data with fallbacks
  const nights = calculateNights(activity.lodgingCheckIn, activity.lodgingCheckOut);
  const checkInTime = activity.lodgingTime?.checkIn || activity.startTime;
  const checkOutTime = activity.lodgingTime?.checkOut || activity.endTime;
  const checkInDate = formatDate(activity.lodgingCheckIn);
  const checkOutDate = formatDate(activity.lodgingCheckOut);
  const checkInTimeFormatted = formatTime12(checkInTime);
  const checkOutTimeFormatted = formatTime12(checkOutTime);
  const lodgingContext = (activity as any).lodgingContext || '';
  const isCheckIn = lodgingContext.includes('Check-in');
  const isCheckOut = lodgingContext.includes('Check-out');

  // Compute current day's date from trip startDate + dayNumber
  let currentDayDate: string | null = null;
  if (startDate && dayNumber) {
    const sd = new Date(startDate);
    if (!isNaN(sd.getTime())) {
      sd.setDate(sd.getDate() + (dayNumber - 1));
      currentDayDate = sd.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }

  const hasDateInfo = checkInDate || checkOutDate || checkInTimeFormatted || checkOutTimeFormatted || currentDayDate;

  const handleDelete = () => {
    if (onDelete && activity) {
      onDelete(activity);
      onClose();
    }
  };

  const handleEdit = () => {
    if (onEdit && activity) {
      onClose();
      onEdit(activity);
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

          {/* Header: Hotel name + context/nights badge */}
          <View style={styles.header}>
            <View style={styles.hotelIcon}>
              <MaterialIcons name="bed" size={18} color="#FFF" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.hotelName} numberOfLines={2}>{activity.name}</Text>
              {activity.formatted_address ? (
                <Text style={styles.hotelAddress} numberOfLines={1}>{activity.formatted_address}</Text>
              ) : null}
            </View>
            {nights > 0 ? (
              <View style={styles.nightsPill}>
                <Ionicons name="moon-outline" size={13} color="#6366F1" />
                <Text style={styles.nightsText}>{nights}n</Text>
              </View>
            ) : lodgingContext ? (
              <View style={styles.contextPill}>
                <Text style={styles.contextText}>{lodgingContext}</Text>
              </View>
            ) : null}
          </View>

          {/* Stay Card - show if we have any date/time info */}
          {hasDateInfo ? (
            <View style={styles.stayCard}>
              {/* Check-in side */}
              <View style={styles.staySide}>
                <Text style={styles.stayLabel}>CHECK-IN</Text>
                <Text style={styles.stayDate}>
                  {checkInDate || currentDayDate || '--'}
                </Text>
                {checkInTimeFormatted ? (
                  <Text style={styles.stayTime}>{checkInTimeFormatted}</Text>
                ) : null}
              </View>

              {/* Center arrow */}
              <View style={styles.stayCenter}>
                <View style={styles.stayDot} />
                <View style={styles.stayLine} />
                <MaterialIcons name="arrow-forward" size={16} color="#6366F1" />
                <View style={styles.stayLine} />
                <View style={styles.stayDot} />
              </View>

              {/* Check-out side */}
              <View style={[styles.staySide, { alignItems: 'flex-end' }]}>
                <Text style={styles.stayLabel}>CHECK-OUT</Text>
                <Text style={styles.stayDate}>
                  {checkOutDate || currentDayDate || '--'}
                </Text>
                {checkOutTimeFormatted ? (
                  <Text style={styles.stayTime}>{checkOutTimeFormatted}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Info row: rating + context badge */}
          <View style={styles.infoRow}>
            {activity.rating ? (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.ratingText}>{activity.rating}</Text>
                {activity.user_ratings_total ? (
                  <Text style={styles.reviewCount}>({activity.user_ratings_total})</Text>
                ) : null}
              </View>
            ) : null}
            {lodgingContext && hasDateInfo ? (
              <View style={styles.contextBadge}>
                <Ionicons
                  name={isCheckIn && isCheckOut ? 'swap-horizontal' : isCheckIn ? 'log-in-outline' : isCheckOut ? 'log-out-outline' : 'moon-outline'}
                  size={14}
                  color="#6366F1"
                />
                <Text style={styles.contextBadgeText}>{lodgingContext}</Text>
              </View>
            ) : null}
          </View>

          {/* Edit Button */}
          {onEdit && currentUserRole !== 'viewer' && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={handleEdit}
              activeOpacity={0.7}
            >
              <Feather name="edit-2" size={15} color="#6366F1" />
              <Text style={styles.editBtnText}>Edit Stay</Text>
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
              <Text style={styles.deleteBtnText}>Remove Stay</Text>
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
  hotelIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  hotelName: {
    fontFamily: 'outfit-semibold',
    fontSize: 16,
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  hotelAddress: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  nightsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  nightsText: {
    fontFamily: 'outfit-semibold',
    fontSize: 13,
    color: '#6366F1',
  },
  contextPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  contextText: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
    color: '#6366F1',
  },

  // Stay Card
  stayCard: {
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
  staySide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  stayLabel: {
    fontFamily: 'outfit-medium',
    fontSize: 10,
    color: '#AEAEB2',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  stayDate: {
    fontFamily: 'outfit-bold',
    fontSize: 16,
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  stayTime: {
    fontFamily: 'outfit-semibold',
    fontSize: 14,
    color: '#6366F1',
    marginTop: 4,
  },

  // Center
  stayCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 20,
    gap: 3,
    flexDirection: 'row',
  },
  stayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D1D6',
  },
  stayLine: {
    width: 10,
    height: 1.5,
    backgroundColor: '#E5E5EA',
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 16,
    gap: 8,
    flexWrap: 'wrap',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  ratingText: {
    fontFamily: 'outfit-semibold',
    fontSize: 13,
    color: '#D97706',
  },
  reviewCount: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#B45309',
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  contextBadgeText: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
    color: '#6366F1',
  },

  // Edit button
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 24,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  editBtnText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#6366F1',
  },

  // Delete button
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 24,
    marginTop: 12,
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

export default HotelDetailModal;

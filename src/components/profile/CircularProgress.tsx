import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CircularProgressProps {
  current: number;
  total: number;
  size?: number;
  label: string;
  sublabel?: string;
  color?: string;
}

export function CircularProgress({
  current,
  total,
  size = 120,
  label,
  sublabel,
  color = '#FF6B35',
}: CircularProgressProps) {
  const progress = total > 0 ? Math.min(current / total, 1) : 0;
  const percentage = Math.round(progress * 100);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer ring background */}
      <View style={[
        styles.outerRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: '#E5E7EB',
        }
      ]}>
        {/* Progress indicator - colored arc simulation using border */}
        <View style={[
          styles.progressRing,
          {
            width: size - 8,
            height: size - 8,
            borderRadius: (size - 8) / 2,
            borderColor: color,
            borderTopColor: progress > 0 ? color : '#E5E7EB',
            borderRightColor: progress > 0.25 ? color : '#E5E7EB',
            borderBottomColor: progress > 0.5 ? color : '#E5E7EB',
            borderLeftColor: progress > 0.75 ? color : '#E5E7EB',
          }
        ]} />

        {/* Inner content */}
        <View style={[
          styles.innerCircle,
          {
            width: size - 24,
            height: size - 24,
            borderRadius: (size - 24) / 2,
          }
        ]}>
          <Text style={styles.currentText}>{current}</Text>
          <Text style={styles.totalText}>/{total}</Text>
          <Text style={styles.labelText}>{label}</Text>
          {sublabel && <Text style={styles.sublabelText}>{sublabel}</Text>}
        </View>
      </View>

      {/* Percentage badge */}
      <View style={[styles.percentBadge, { backgroundColor: color }]}>
        <Text style={styles.percentText}>{percentage}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerRing: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    backgroundColor: '#F9FAFB',
  },
  progressRing: {
    position: 'absolute',
    borderWidth: 6,
  },
  innerCircle: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  currentText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  totalText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: -4,
  },
  labelText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  sublabelText: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  percentBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  percentText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

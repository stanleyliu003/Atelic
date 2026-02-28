import * as Notifications from 'expo-notifications';

/**
 * DEV/DEMO ONLY — fires local notifications that mimic nudge push notifications.
 * These look identical to real APNs pushes but work on the simulator.
 */

async function ensurePermissions() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === 'granted';
  }
  return true;
}

export async function fireOpenDayWarningNudge(city = 'Tokyo', emptyDays = 2, tripId = null) {
  const granted = await ensurePermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${city} trip needs attention`,
      body: `You still have ${emptyDays} open days in ${city}. Need a recommendation to fill the gap?`,
      data: { type: 'open_day_warning', selectedCity: city, tripId },
      sound: true,
    },
    trigger: { seconds: 1 },
  });
}

export async function firePlanningDriftNudge(city = 'Barcelona', tripId = null) {
  const granted = await ensurePermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Your ${city} plans are waiting.`,
      body: 'A few tweaks now means confident travel later. Pick up where you left off.',
      data: { type: 'planning_drift', selectedCity: city, tripId },
      sound: true,
    },
    trigger: { seconds: 1 },
  });
}

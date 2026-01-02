import { Linking, Platform } from 'react-native';

export interface RideHailingParams {
  pickupLat: number;
  pickupLng: number;
  pickupName?: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffName?: string;
}

/**
 * Check if Uber app is installed on the device
 */
export async function isUberInstalled(): Promise<boolean> {
  try {
    const uberScheme = 'uber://';
    return await Linking.canOpenURL(uberScheme);
  } catch (error) {
    console.error('[RideHailing] Error checking Uber installation:', error);
    return false;
  }
}

/**
 * Check if Lyft app is installed on the device
 */
export async function isLyftInstalled(): Promise<boolean> {
  try {
    const lyftScheme = 'lyft://';
    return await Linking.canOpenURL(lyftScheme);
  } catch (error) {
    console.error('[RideHailing] Error checking Lyft installation:', error);
    return false;
  }
}

/**
 * Open Uber app with pre-filled pickup and destination
 * Falls back to web version if app is not installed
 */
export async function openUber(params: RideHailingParams): Promise<void> {
  try {
    const { pickupLat, pickupLng, pickupName, dropoffLat, dropoffLng, dropoffName } = params;

    // Encode names for URL - ensure proper formatting
    const encodedPickupName = pickupName ? encodeURIComponent(pickupName) : '';
    const encodedDropoffName = dropoffName ? encodeURIComponent(dropoffName) : '';

    // Uber deep link with formatted address
    // Format: uber://?client_id=<CLIENT_ID>&action=setPickup&pickup[latitude]=37.775&pickup[longitude]=-122.4183&pickup[formatted_address]=...&dropoff[latitude]=37.7577&dropoff[longitude]=-122.4376&dropoff[formatted_address]=...
    const appUrl = `uber://?action=setPickup` +
      `&pickup[latitude]=${pickupLat}` +
      `&pickup[longitude]=${pickupLng}` +
      (pickupName ? `&pickup[formatted_address]=${encodedPickupName}` : '') +
      `&dropoff[latitude]=${dropoffLat}` +
      `&dropoff[longitude]=${dropoffLng}` +
      (dropoffName ? `&dropoff[formatted_address]=${encodedDropoffName}` : '');

    console.log('[RideHailing] Uber App URL:', appUrl);

    const canOpenApp = await Linking.canOpenURL(appUrl);

    if (canOpenApp) {
      await Linking.openURL(appUrl);
      console.log('[RideHailing] Opened Uber app');
    } else {
      // Fall back to universal web link
      const webUrl = `https://m.uber.com/ul/?` +
        `action=setPickup` +
        `&pickup[latitude]=${pickupLat}` +
        `&pickup[longitude]=${pickupLng}` +
        (pickupName ? `&pickup[formatted_address]=${encodedPickupName}` : '') +
        `&dropoff[latitude]=${dropoffLat}` +
        `&dropoff[longitude]=${dropoffLng}` +
        (dropoffName ? `&dropoff[formatted_address]=${encodedDropoffName}` : '');

      console.log('[RideHailing] Uber Web URL:', webUrl);
      await Linking.openURL(webUrl);
      console.log('[RideHailing] Opened Uber web');
    }
  } catch (error) {
    console.error('[RideHailing] Error opening Uber:', error);
    throw new Error('Failed to open Uber. Please make sure the app is installed or try again.');
  }
}

/**
 * Open Lyft app with pre-filled pickup and destination
 * Falls back to web version if app is not installed
 *
 * Based on official Lyft SDK documentation:
 * - iOS SDK: https://github.com/lyft/Lyft-iOS-sdk/blob/master/Sources/LyftUI/LyftDeepLink.swift
 * - Android SDK: https://github.com/lyft/lyft-android-sdk/blob/master/deeplink/src/main/java/com/lyft/deeplink/DeepLink.java
 */
export async function openLyft(params: RideHailingParams): Promise<void> {
  try {
    const { pickupLat, pickupLng, pickupName, dropoffLat, dropoffLng, dropoffName } = params;

    // Encode address names for URL
    const pickupAddress = pickupName ? encodeURIComponent(pickupName) : '';
    const dropoffAddress = dropoffName ? encodeURIComponent(dropoffName) : '';

    // Lyft deep link format with coordinates and addresses
    // Format: lyft://ridetype?id=lyft&pickup[latitude]=37.7577&pickup[longitude]=-122.4376&pickup[address]=...&destination[latitude]=37.7577&destination[longitude]=-122.4376&destination[address]=...
    const appUrl = `lyft://ridetype?id=lyft` +
      `&pickup[latitude]=${pickupLat}` +
      `&pickup[longitude]=${pickupLng}` +
      (pickupAddress ? `&pickup[address]=${pickupAddress}` : '') +
      `&destination[latitude]=${dropoffLat}` +
      `&destination[longitude]=${dropoffLng}` +
      (dropoffAddress ? `&destination[address]=${dropoffAddress}` : '');

    console.log('[RideHailing] Lyft App URL:', appUrl);
    console.log('[RideHailing] Lyft Pickup:', { lat: pickupLat, lng: pickupLng, name: pickupName });
    console.log('[RideHailing] Lyft Destination:', { lat: dropoffLat, lng: dropoffLng, name: dropoffName });

    const canOpenApp = await Linking.canOpenURL(appUrl);

    if (canOpenApp) {
      await Linking.openURL(appUrl);
      console.log('[RideHailing] Opened Lyft app');
    } else {
      // Fall back to Lyft web link
      const webUrl = `https://ride.lyft.com/u?id=lyft` +
        `&pickup[latitude]=${pickupLat}` +
        `&pickup[longitude]=${pickupLng}` +
        (pickupAddress ? `&pickup[address]=${pickupAddress}` : '') +
        `&destination[latitude]=${dropoffLat}` +
        `&destination[longitude]=${dropoffLng}` +
        (dropoffAddress ? `&destination[address]=${dropoffAddress}` : '');

      console.log('[RideHailing] Lyft Web URL:', webUrl);
      await Linking.openURL(webUrl);
      console.log('[RideHailing] Opened Lyft web');
    }
  } catch (error) {
    console.error('[RideHailing] Error opening Lyft:', error);
    throw new Error('Failed to open Lyft. Please make sure the app is installed or try again.');
  }
}

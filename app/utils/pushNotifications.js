// Push notification utilities for Expo
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase/config';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register device for push notifications
 * @param {string} userId - User UID
 * @returns {Promise<string|null>} Expo push token or null
 */
export const registerForPushNotificationsAsync = async (userId) => {
  if (!Device.isDevice) {
    console.warn('[pushNotifications] Must use physical device for push notifications');
    return null;
  }

  try {
    console.log('[pushNotifications] Starting push notification registration...');
    
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[pushNotifications] Existing permission status:', existingStatus);
    
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('[pushNotifications] Requesting permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[pushNotifications] Permission request result:', status);
    }

    if (finalStatus !== 'granted') {
      console.warn('[pushNotifications] Permission denied. Status:', finalStatus);
      return null;
    }

    console.log('[pushNotifications] Permissions granted, getting Expo push token...');
    
    // Get project ID from Constants (preferred) or fallback to hardcoded value
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'e115eb18-f788-494b-9af1-f1a7976747d3';
    console.log('[pushNotifications] Using project ID:', projectId);
    
    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    const token = tokenData.data;
    
    console.log('[pushNotifications] Expo push token received:', token ? `${token.substring(0, 20)}...` : 'null');

    // Save token to Firestore
    if (firestore && userId) {
      try {
        const userTokenRef = doc(firestore, 'userPushTokens', userId);
        await setDoc(
          userTokenRef,
          {
            expoPushToken: token,
            platform: Platform.OS,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        console.log('[pushNotifications] Token saved to Firestore successfully');
      } catch (error) {
        console.error('[pushNotifications] Error saving token to Firestore:', error);
        // Don't return null - token is still valid even if Firestore save fails
      }
    } else {
      console.warn('[pushNotifications] Firestore not available or userId missing, token not saved');
    }

    return token;
  } catch (error) {
    console.error('[pushNotifications] Error registering for push notifications:', error);
    console.error('[pushNotifications] Error details:', error.message, error.stack);
    return null;
  }
};

/**
 * Get push token for a user
 * @param {string} userId - User UID
 * @returns {Promise<string|null>} Expo push token or null
 */
export const getUserPushToken = async (userId) => {
  if (!firestore || !userId) {
    return null;
  }

  try {
    const userTokenRef = doc(firestore, 'userPushTokens', userId);
    const tokenDoc = await getDoc(userTokenRef);

    if (tokenDoc.exists()) {
      return tokenDoc.data().expoPushToken || null;
    }
    return null;
  } catch (error) {
    const code = error?.code || '';
    if (code === 'permission-denied' || code === 'missing-or-insufficient-permissions') {
      console.warn('[pushNotifications] Cannot read push token (Firestore rules):', userId);
    } else {
      console.warn('[pushNotifications] Error getting user push token:', error?.message || error);
    }
    return null;
  }
};

/**
 * Send push notification using Expo Push Notification service
 * @param {string} expoPushToken - Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data
 * @returns {Promise<boolean>} Success status
 */
export const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  if (!expoPushToken) {
    console.warn('[pushNotifications] No push token provided');
    return false;
  }

  try {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      badge: 1,
    };

    console.log('[pushNotifications] Sending push notification to:', expoPushToken.substring(0, 20) + '...');
    console.log('[pushNotifications] Notification title:', title);
    console.log('[pushNotifications] Notification body:', body);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('[pushNotifications] HTTP error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[pushNotifications] Error response:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('[pushNotifications] Push notification API response:', JSON.stringify(result, null, 2));
    
    // Check for success - the API can return success in different formats
    if (result.data && Array.isArray(result.data)) {
      const success = result.data.some(item => item.status === 'ok');
      if (success) {
        console.log('[pushNotifications] Push notification sent successfully');
        return true;
      } else {
        console.error('[pushNotifications] Failed to send push notification:', result.data);
        return false;
      }
    } else if (result.data?.status === 'ok') {
      console.log('[pushNotifications] Push notification sent successfully');
      return true;
    } else {
      console.error('[pushNotifications] Failed to send push notification:', result);
      return false;
    }
  } catch (error) {
    console.error('[pushNotifications] Error sending push notification:', error);
    console.error('[pushNotifications] Error details:', error.message, error.stack);
    return false;
  }
};

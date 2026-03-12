// Notification service for sending push notifications (no database storage)
import { query, where, getDocs, collection } from 'firebase/firestore';
import { firestore } from './config';
import { getUserPushToken, sendPushNotification } from '../utils/pushNotifications';

const isFirestoreAvailable = !!firestore;

/**
 * Create attendance notifications for students (push notifications only, no database storage)
 * @param {Object} params - Notification parameters
 * @param {string} params.classId - Class ID
 * @param {string} params.subjectId - Subject ID
 * @param {string} params.subjectName - Subject name
 * @param {string} params.className - Class name with section
 * @param {string} params.date - Attendance date
 * @param {string[]} params.presentStudents - Array of roll numbers marked present
 * @param {string[]} params.absentStudents - Array of roll numbers marked absent
 * @param {string} params.teacherName - Name of the teacher who submitted attendance
 */
export const createAttendanceNotifications = async ({
  classId,
  subjectId,
  subjectName,
  className,
  date,
  presentStudents,
  absentStudents,
  teacherName,
}) => {
  if (!isFirestoreAvailable) {
    console.warn('[notificationService] Firestore not available, skipping notifications');
    return;
  }

  try {
    // Get all students in this class
    const studentsQuery = query(
      collection(firestore, 'students'),
      where('classId', '==', classId)
    );
    const studentsSnapshot = await getDocs(studentsQuery);
    const students = studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Send push notifications for each student
    const pushNotificationPromises = [];

    students.forEach((student) => {
      const rollNo = student.rollNo || student.rollNumber;
      if (!rollNo || !student.uid) {
        // Skip if student doesn't have roll number or uid (not registered yet)
        return;
      }

      const isPresent = presentStudents.includes(rollNo);
      const isAbsent = absentStudents.includes(rollNo);

      // Only send notification if student is marked as present or absent
      if (isPresent || isAbsent) {
        const title = isPresent ? 'Attendance Marked: Present' : 'Attendance Marked: Absent';
        const message = `${subjectName} - ${className}\nDate: ${new Date(date).toLocaleDateString()}\nStatus: ${isPresent ? 'Present ✓' : 'Absent ✗'}`;
        
        // Send push notification
        const pushPromise = (async () => {
          try {
            const pushToken = await getUserPushToken(student.uid);
            if (pushToken) {
              const success = await sendPushNotification(
                pushToken,
                title,
                message,
                {
                  type: 'attendance',
                  classId,
                  subjectId,
                  subjectName,
                  className,
                  date,
                  status: isPresent ? 'present' : 'absent',
                  rollNo,
                }
              );
              if (success) {
                console.log(`[notificationService] Push notification sent to ${student.uid}`);
              }
            } else {
              console.warn(`[notificationService] No push token found for student ${student.uid}`);
            }
          } catch (error) {
            console.error(`[notificationService] Error sending push notification to ${student.uid}:`, error);
            // Don't fail the whole process if push notification fails
          }
        })();
        
        pushNotificationPromises.push(pushPromise);
      }
    });

    await Promise.all(pushNotificationPromises);
    console.log(`[notificationService] Sent ${pushNotificationPromises.length} push notifications`);
  } catch (error) {
    console.error('[notificationService] Error creating notifications:', error);
    // Don't throw - we don't want notification failures to break attendance saving
  }
};

/**
 * Notify enrolled students (by class) when a new assignment is posted.
 * @param {{ classId: string, subjectId: string, assignmentName: string }} params
 */
export const createAssignmentNotifications = async ({ classId, subjectId, assignmentName }) => {
  if (!isFirestoreAvailable || !classId || !assignmentName) return;
  try {
    const studentsQuery = query(
      collection(firestore, 'students'),
      where('classId', '==', classId)
    );
    const studentsSnapshot = await getDocs(studentsQuery);
    const students = studentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    const promises = students.map(async (student) => {
      if (!student.uid) return;
      try {
        const pushToken = await getUserPushToken(student.uid);
        if (pushToken) {
          await sendPushNotification(
            pushToken,
            'New Assignment Posted',
            assignmentName,
            { type: 'assignment', subjectId, classId }
          );
        }
      } catch (err) {
        console.warn('[notificationService] Assignment push failed for', student.uid, err);
      }
    });
    await Promise.all(promises);
  } catch (error) {
    console.error('[notificationService] createAssignmentNotifications error', error);
  }
};

// Note: Database notification functions removed - notifications are now push-only
// These functions are kept for backward compatibility but return empty results

/**
 * Get notifications for a user (deprecated - notifications are push-only now)
 * @param {string} userId - User UID
 * @param {boolean} unreadOnly - If true, only return unread notifications
 * @returns {Promise<Array>} Always returns empty array
 */
export const getUserNotifications = async (userId, unreadOnly = false) => {
  console.warn('[notificationService] getUserNotifications is deprecated - notifications are push-only');
  return [];
};

/**
 * Mark a notification as read (deprecated - notifications are push-only now)
 * @param {string} notificationId - Notification document ID
 */
export const markNotificationAsRead = async (notificationId) => {
  console.warn('[notificationService] markNotificationAsRead is deprecated - notifications are push-only');
  return;
};

/**
 * Mark all notifications as read for a user (deprecated - notifications are push-only now)
 * @param {string} userId - User UID
 */
export const markAllNotificationsAsRead = async (userId) => {
  console.warn('[notificationService] markAllNotificationsAsRead is deprecated - notifications are push-only');
  return;
};

/**
 * Get unread notification count for a user (deprecated - notifications are push-only now)
 * @param {string} userId - User UID
 * @returns {Promise<number>} Always returns 0
 */
export const getUnreadNotificationCount = async (userId) => {
  return 0;
};

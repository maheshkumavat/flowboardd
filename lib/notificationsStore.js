import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const NOTIFS_FILE = path.join(DATA_DIR, 'notifications_store.json');

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(NOTIFS_FILE)) {
    fs.writeFileSync(NOTIFS_FILE, JSON.stringify([], null, 2));
  }
}

function readNotificationsFromFile() {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(NOTIFS_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('Failed to read notifications file:', err);
    return [];
  }
}

function writeNotificationsToFile(data) {
  ensureStoreFile();
  try {
    fs.writeFileSync(NOTIFS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to write notifications file:', err);
  }
}

export function addNotification({
  userId,
  type = 'join_request',
  author = 'FlowBoard',
  action = 'sent a request',
  text = '',
  projectId = null,
  taskId = null,
  requestId = null,
  requesterId = null,
  role = 'MEMBER',
  status = 'pending',
  userPreferences = null,
}) {
  if (!userId) return null;

  // Item 5: Respect notification preference toggles
  if (userPreferences) {
    if (type === 'task_assigned' && userPreferences.taskAssigned === false) return null;
    if (type === 'join_request' && userPreferences.joinRequests === false) return null;
    if (type === 'comment' && userPreferences.comments === false) return null;
  }

  const notifs = readNotificationsFromFile();

  const notifObj = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    userId,
    type,
    author,
    action,
    text,
    projectId,
    taskId,
    requestId,
    requesterId,
    role,
    status: type === 'join_request' ? status : null,
    time: 'Just now',
    createdAt: new Date().toISOString(),
    read: false,
  };

  notifs.unshift(notifObj);
  writeNotificationsToFile(notifs);
  return notifObj;
}

export function updateNotificationStatusByRequestId({ requestId, projectId, requesterId, status }) {
  const notifs = readNotificationsFromFile();
  const isApproved = status === 'approved' || status === 'accepted' || status === 'accept';
  const resolvedAction = isApproved ? 'accepted join request' : 'declined join request';
  const finalStatus = isApproved ? 'approved' : 'rejected';

  const updated = notifs.map((n) => {
    const matchByReqId = requestId && (n.requestId === requestId || n.id === requestId);
    const matchByProjUser = !requestId && projectId && n.projectId === projectId && (n.requesterId === requesterId || n.type === 'join_request');

    if (matchByReqId || matchByProjUser) {
      return {
        ...n,
        status: finalStatus,
        read: true,
        action: resolvedAction,
      };
    }
    return n;
  });
  writeNotificationsToFile(updated);
}

export function getNotificationsForUser(userId) {
  if (!userId) return [];
  const notifs = readNotificationsFromFile();
  return notifs.filter((n) => n.userId === userId);
}

export function deleteNotifications(userId, notificationId = null) {
  if (!userId) return;
  const notifs = readNotificationsFromFile();
  const updated = notifs.filter((n) => {
    if (n.userId === userId) {
      if (!notificationId || n.id === notificationId) {
        return false; // Remove notification
      }
    }
    return true; // Keep notification
  });
  writeNotificationsToFile(updated);
}

export function markNotificationsRead(userId, notificationId = null) {
  deleteNotifications(userId, notificationId);
}


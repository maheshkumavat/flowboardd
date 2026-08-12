import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages_store.json');

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
  }
}

function readMessagesFromFile() {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('Failed to read messages file:', err);
    return [];
  }
}

function writeMessagesToFile(data) {
  ensureStoreFile();
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to write messages file:', err);
  }
}

export function getProjectMessages(projectId) {
  if (!projectId) return [];
  const messages = readMessagesFromFile();
  return messages.filter((m) => m.project_id === projectId);
}

export function addProjectMessage({ projectId, userId, content, imageUrl, senderName, senderEmail }) {
  if (!projectId || !userId || (!content && !imageUrl)) return null;
  const messages = readMessagesFromFile();

  const msgObj = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    project_id: projectId,
    user_id: userId,
    content: (content || '').trim(),
    image_url: imageUrl || null,
    created_at: new Date().toISOString(),
    user: {
      id: userId,
      name: senderName || senderEmail?.split('@')[0] || 'Team Member',
      email: senderEmail || '',
    },
  };

  messages.push(msgObj);
  writeMessagesToFile(messages);
  return msgObj;
}

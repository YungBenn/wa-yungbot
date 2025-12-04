import { Client, LocalAuth, type Message, type Chat } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'node:fs';
import path from 'node:path';

const SESSION_DATA_PATH = '.wwebjs_auth';
const BACKUP_DIR = 'backups';
const CLIENT_ID = 'wa-yungbot-main';

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export const client = new Client({
  authStrategy: new LocalAuth({
    clientId: CLIENT_ID,
    dataPath: SESSION_DATA_PATH,
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  restartOnAuthFail: false,
});

let repliedContacts: Record<string, string> = {};

let isAuthenticated = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0]!;
}

function hasRepliedToday(contactId: string): boolean {
  const today = getTodayDate();
  return repliedContacts[contactId] === today;
}

function markRepliedToday(contactId: string): void {
  const today = getTodayDate();
  repliedContacts[contactId] = today;
}

function cleanOldData(): void {
  const today = getTodayDate();
  let cleaned = 0;

  for (const [contactId, date] of Object.entries(repliedContacts)) {
    if (date !== today) {
      delete repliedContacts[contactId];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} old records from memory`);
  }
}

export function resetContact(contactId: string): void {
  delete repliedContacts[contactId];
  console.log(`Reset tracking for contact: ${contactId}`);
}

export function resetAllContacts(): void {
  repliedContacts = {};
  console.log('All contact tracking reset');
}

// Clean old data every hour
setInterval(() => {
  cleanOldData();
}, 3600000);

function copyDirectory(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

interface BackupInfo {
  name: string;
  path: string;
  time: number;
}

// Remove old backups, only keep the last 5 backups
function cleanupOldBackups(): void {
  try {
    const backups: BackupInfo[] = fs
      .readdirSync(BACKUP_DIR)
      .filter((file) => file.startsWith('session-backup-'))
      .map((file) => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (backups.length > 5) {
      const toDelete = backups.slice(5);
      for (const backup of toDelete) {
        fs.rmSync(backup.path, { recursive: true, force: true });
        console.log(`🗑️  Old backup deleted: ${backup.name}`);
      }
    }
  } catch (error) {
    console.error('Error when cleaning up backup:', (error as Error).message);
  }
}

function backupSession(): void {
  try {
    if (!fs.existsSync(SESSION_DATA_PATH)) {
      console.log('⚠️  Session data not found, skip backup');
      return;
    }

    const timestamp = new Date()
      .toISOString()
      .replaceAll(':', '-')
      .replaceAll('.', '-');
    const backupPath = path.join(BACKUP_DIR, `session-backup-${timestamp}`);

    copyDirectory(SESSION_DATA_PATH, backupPath);

    console.log(`✅ Session backup successful: ${backupPath}`);

    cleanupOldBackups();
  } catch (error) {
    console.error(
      '❌ Error when backing up session:',
      (error as Error).message
    );
  }
}

// Automatic backup every 6 hours
setInterval(() => {
  if (isAuthenticated) {
    backupSession();
  }
}, 6 * 60 * 60 * 1000);

client.on('qr', (qr: string) => {
  console.log('\n⚠️  ============================================');
  console.log('⚠️  AUTHENTICATION REQUIRED - SCAN QR CODE');
  console.log('⚠️  ============================================');
  console.log('📱 Scan QR code below with WhatsApp:');
  console.log('');
  qrcode.generate(qr, { small: true });
  console.log('\n⚠️  After scanning, bot will automatically connect.');
  console.log('⚠️  ============================================\n');
  isAuthenticated = false;
});

client.on('loading_screen', (percent: number, message: string) => {
  console.log(`🔄 Loading: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
  console.log('✅ Authentication successful! Session saved.');
  isAuthenticated = true;
  reconnectAttempts = 0;
});

function restartClient(): void {
  try {
    console.log('🔄 Trying to restart client...');
    client.initialize();
  } catch (error) {
    console.error('❌ Error when restarting client:', (error as Error).message);
  }
}

client.on('auth_failure', (msg: string) => {
  console.error('\n❌ ============================================');
  console.error('❌ AUTHENTICATION FAILED');
  console.error('❌ ============================================');
  console.error(`❌ Error: ${msg}`);
  console.error('❌ Session may have expired or invalid.');
  console.error('❌ Bot will try to restart...');
  console.error('❌ ============================================\n');
  isAuthenticated = false;

  if (fs.existsSync(SESSION_DATA_PATH)) {
    backupSession();
  }

  setTimeout(() => {
    restartClient();
  }, 5000);
});

client.on('disconnected', (reason: string) => {
  console.error('\n⚠️  ============================================');
  console.error('⚠️  CLIENT DISCONNECTED');
  console.error('⚠️  ============================================');
  console.error(`⚠️  Reason: ${reason}`);
  console.error('⚠️  Trying to reconnect...');
  console.error('⚠️  ============================================\n');
  isAuthenticated = false;

  if (fs.existsSync(SESSION_DATA_PATH)) {
    backupSession();
  }

  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    setTimeout(() => {
      restartClient();
    }, 5000);
  } else {
    console.error(
      `❌ Maximum reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`
    );
    console.error('❌ Please restart the application manually.');
  }
});

client.on('ready', () => {
  console.log('\n✅ ============================================');
  console.log('✅ WHATSAPP BOT READY!');
  console.log('✅ ============================================');
  console.log('✅ Session successfully restored from:', SESSION_DATA_PATH);
  console.log('✅ Personal Assistant active - Auto-reply once per day');
  console.log('✅ ============================================\n');

  isAuthenticated = true;
  reconnectAttempts = 0;

  backupSession();

  cleanOldData();
});

client.on('message', async (message: Message) => {
  try {
    const chat = await message.getChat();

    if (!chat.isGroup) {
      const contact = await message.getContact();
      const contactId = contact.id._serialized;

      if (!contact.isMe) {
        if (!hasRepliedToday(contactId)) {
          await message.reply('[BOT 🤖] Ruben will reply to you shortly');

          markRepliedToday(contactId);

          console.log(
            `✅ Auto-reply sent to: ${
              contact.pushname || contact.number
            } (${contactId})`
          );
        }
      }
    }
  } catch (error) {
    console.error('Error when replying to message:', error);
  }
});

export async function sendDeploymentNotification(
  groupId: string,
  message: string
): Promise<boolean> {
  try {
    const chat = await client.getChatById(groupId);
    await chat.sendMessage(message);
    console.log('Deployment notification sent!');
    return true;
  } catch (error) {
    console.error('Error when sending notification:', error);
    return false;
  }
}

export async function listGroups() {
  const chats = await client.getChats();
  const groups = chats.filter((chat: Chat) => chat.isGroup);

  console.log('\n=== WhatsApp Group List ===');
  let index = 1;
  for (const group of groups) {
    console.log(`${index}. ${group.name}`);
    console.log(`   ID: ${group.id._serialized}\n`);
    index++;
  }

  return groups;
}

if (fs.existsSync(SESSION_DATA_PATH)) {
  console.log('📦 Session data found, creating backup...');
  backupSession();
}

console.log('🚀 Starting WhatsApp Bot initialization...');
console.log(`📁 Session data path: ${SESSION_DATA_PATH}`);
console.log(`🆔 Client ID: ${CLIENT_ID}\n`);
client.initialize();

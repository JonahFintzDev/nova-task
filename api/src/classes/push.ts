// node_modules
import webpush from 'web-push';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// classes
import { db } from './database';
import { config } from './config';

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

const VAPID_KEYS_FILE = 'vapid-keys.json';
const VAPID_SUBJECT = 'mailto:admin@localhost';

let vapidKeys: { publicKey: string; privateKey: string } | null = null;

export function ensureVapidKeys(): void {
  if (vapidKeys) return;

  const filePath = join(config.configDir, VAPID_KEYS_FILE);

  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw) as { publicKey?: string; privateKey?: string };
      if (data.publicKey && data.privateKey) {
        vapidKeys = { publicKey: data.publicKey, privateKey: data.privateKey };
        return;
      }
    } catch {
      // fall through to generate
    }
  }

  const keys = webpush.generateVAPIDKeys();
  const dir = config.configDir;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(keys, null, 2) + '\n', 'utf8');
  vapidKeys = { publicKey: keys.publicKey, privateKey: keys.privateKey };
  console.log(`[push] Generated VAPID keys and saved to ${filePath}`);
}

function getVapidKeys(): { publicKey: string; privateKey: string } | null {
  if (!vapidKeys) ensureVapidKeys();
  return vapidKeys;
}

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const keys = getVapidKeys();
  if (!keys) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  configured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return getVapidKeys()?.publicKey ?? null;
}

export function isPushConfigured(): boolean {
  return getVapidPublicKey() !== null;
}

async function sendToEndpoint(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<void> {
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    url: payload.url ?? '/',
    icon: '/icon-192.png',
  });
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      message,
    );
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await db.deletePushSubscriptionByEndpoint(sub.endpoint);
    }
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const subscriptions = await db.listPushSubscriptionsByUser(userId);
  if (subscriptions.length === 0) return;
  await Promise.all(subscriptions.map((sub) => sendToEndpoint(sub, payload)));
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const subscriptions = await db.listPushSubscriptions();
  if (subscriptions.length === 0) return;
  await Promise.all(subscriptions.map((sub) => sendToEndpoint(sub, payload)));
}

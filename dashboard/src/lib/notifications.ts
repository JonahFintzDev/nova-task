// classes
import { pushApi } from '@/classes/api';

const STORAGE_KEY = 'nova-task-notifications-enabled';

export function isNotificationsEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function canRequestPermission(): boolean {
  return 'Notification' in window;
}

export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.requestPermission();
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = window.atob(padded);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

function extractKeys(sub: PushSubscription): { p256dh: string; auth: string } | null {
  const p256dh = sub.getKey('p256dh');
  const auth = sub.getKey('auth');
  if (!p256dh || !auth) return null;
  const toBase64 = (arr: ArrayBuffer): string => {
    const bytes = new Uint8Array(arr);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  };
  return { p256dh: toBase64(p256dh), auth: toBase64(auth) };
}

export async function syncPushSubscription(enabled: boolean): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();

  if (!enabled || Notification.permission !== 'granted') {
    if (existing) {
      try {
        await pushApi.unsubscribe(existing.endpoint);
      } catch {
        // ignore backend sync errors
      }
      await existing.unsubscribe();
    }
    return;
  }

  const data = await pushApi.getPublicKey();
  if (!data.enabled || !data.publicKey) return;

  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(data.publicKey),
    }));

  const keys = extractKeys(subscription);
  if (!keys) return;
  await pushApi.subscribe({ endpoint: subscription.endpoint, keys });
}

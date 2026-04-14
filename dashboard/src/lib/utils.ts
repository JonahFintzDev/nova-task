// node_modules
import dayjs from 'dayjs';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// types
import type { Priority } from '@/@types/index';

export function formatDueDate(
  iso: string | null | undefined,
  hasTime: boolean,
  locale: string,
): string {
  if (!iso) {
    return '';
  }
  const d = dayjs(iso);
  if (hasTime) {
    return d.locale(locale).format('lll');
  }
  return d.locale(locale).format('ll');
}

export function isOverdue(iso: string | null | undefined, done: boolean): boolean {
  if (!iso || done) {
    return false;
  }
  return dayjs(iso).isBefore(dayjs(), 'minute');
}

export function isDueToday(iso: string | null | undefined): boolean {
  if (!iso) {
    return false;
  }
  return dayjs(iso).isSame(dayjs(), 'day');
}

export function isDueSoon(iso: string | null | undefined, days = 3): boolean {
  if (!iso) {
    return false;
  }
  const d = dayjs(iso);
  const end = dayjs().add(days, 'day');
  return d.isAfter(dayjs(), 'day') && (d.isBefore(end) || d.isSame(end, 'day'));
}

export function priorityLabel(priority: Priority, translate: (key: string) => string): string {
  const map: Record<Priority, string> = {
    NONE: translate('priority.none'),
    LOW: translate('priority.low'),
    MEDIUM: translate('priority.medium'),
    HIGH: translate('priority.high'),
    URGENT: translate('priority.urgent'),
  };
  return map[priority] ?? priority;
}

export function priorityBadgeClass(priority: Priority): string {
  if (priority === 'NONE') {
    return '';
  }
  if (priority === 'LOW') {
    return 'text-text-muted border-border';
  }
  if (priority === 'MEDIUM') {
    return 'text-warning border-warning/40 bg-warning/10';
  }
  if (priority === 'HIGH') {
    return 'text-primary border-primary/40 bg-primary/10';
  }
  return 'text-destructive border-destructive/40 bg-destructive/10';
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(clsx(parts));
}

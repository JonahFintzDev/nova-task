// classes
import { db } from './database';
import { sendPushToUser } from './push';

async function checkAndSendReminders(): Promise<void> {
  try {
    const now = new Date();
    const tasks = await db.findTasksDueForReminder(now);

    for (const task of tasks) {
      const isOverdue = task.dueDate !== null && task.dueDate <= now;
      await sendPushToUser(task.userId, {
        title: isOverdue ? 'Overdue task' : 'Task due soon',
        body: task.title,
        tag: `task-reminder-${task.id}`,
        url: '/',
      });
      await db.setTaskReminderSent(task.id, now);
    }
  } catch (error) {
    console.error('[scheduler] reminder check failed:', error);
  }
}

export function startScheduler(): void {
  // First run after 2 minutes, then every hour
  setTimeout(() => {
    void checkAndSendReminders();
    setInterval(() => {
      void checkAndSendReminders();
    }, 60 * 60 * 1000);
  }, 2 * 60 * 1000);
}

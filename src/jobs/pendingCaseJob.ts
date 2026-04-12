import cron from 'node-cron';
import Case from '../models/Case';

export function startPendingCaseJob(): void {
  // Run daily at midnight — shift inactive cases to pending
  cron.schedule('0 0 * * *', async () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    try {
      const updated = await Case.updateMany(
        {
          status: 'active',
          lastActivityAt: { $lt: threeMonthsAgo },
        },
        { $set: { status: 'pending' } }
      );

      console.log(
        `[CRON] Auto-shifted ${updated.modifiedCount} inactive cases to pending status.`
      );
    } catch (error) {
      console.error('[CRON] Pending case job failed:', error);
    }
  });

  // Run every minute — lock evidence uploaded > 15 min ago
  cron.schedule('* * * * *', async () => {
    try {
      await lockOverdueEvidence();
    } catch (error) {
      console.error('[CRON] Evidence lock job failed:', error);
    }
  });

  console.log('[CRON] Pending case + evidence lock jobs scheduled');
}

// Also lock evidence that should have been locked but wasn't (e.g., server restart)
export async function lockOverdueEvidence(): Promise<void> {
  const { default: Evidence } = await import('../models/Evidence');
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const result = await Evidence.updateMany(
    {
      isImmutable: false,
      uploadTimestamp: { $lt: fifteenMinutesAgo },
      deletedAt: { $exists: false },
    },
    { $set: { isImmutable: true } }
  );

  if (result.modifiedCount > 0) {
    console.log(`[STARTUP] Locked ${result.modifiedCount} overdue evidence records.`);
  }
}

import { admin } from '../config/firebase';
import User from '../models/User';
import mongoose from 'mongoose';

interface NotifyOptions {
  caseId?: string;
  title: string;
  body: string;
  roles?: string[];
  userIds?: mongoose.Types.ObjectId[];
  data?: Record<string, string>;
}

export async function firebaseNotify(options: NotifyOptions): Promise<void> {
  try {
    let tokens: string[] = [];

    if (options.userIds && options.userIds.length > 0) {
      const users = await User.find({
        _id: { $in: options.userIds },
        fcmToken: { $exists: true, $ne: null },
      }).select('fcmToken');
      tokens = users.map((u) => u.fcmToken).filter(Boolean) as string[];
    } else if (options.roles && options.roles.length > 0) {
      const users = await User.find({
        role: { $in: options.roles },
        fcmToken: { $exists: true, $ne: null },
      }).select('fcmToken');
      tokens = users.map((u) => u.fcmToken).filter(Boolean) as string[];
    }

    if (tokens.length === 0) return;

    const message = {
      notification: {
        title: options.title,
        body: options.body,
      },
      data: {
        ...(options.caseId ? { caseId: options.caseId } : {}),
        ...(options.data ?? {}),
      },
      tokens,
    };

    await admin.messaging().sendEachForMulticast(message);
  } catch (error) {
    // Notification failures should not crash the main flow
    console.error('FCM notification error:', error);
  }
}

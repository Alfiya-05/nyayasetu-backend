import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

let bucket: GridFSBucket;

export function initGridFS(): void {
  const db = mongoose.connection.db;
  if (db) {
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
    console.log('GridFS bucket initialized');
    return;
  }
  // Fallback: if connection isn't fully ready, wait for 'open'
  mongoose.connection.once('open', () => {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, {
      bucketName: 'uploads',
    });
    console.log('GridFS bucket initialized');
  });
}

export function getBucket(): GridFSBucket {
  if (!bucket) {
    throw new Error('GridFS bucket not initialized. Ensure MongoDB is connected first.');
  }
  return bucket;
}

/**
 * Uploads a file buffer to GridFS and returns the stored ObjectId.
 */
export function uploadToGridFS(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<mongoose.Types.ObjectId> {
  return new Promise((resolve, reject) => {
    const uploadStream = getBucket().openUploadStream(filename, { contentType });
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id as mongoose.Types.ObjectId));
    uploadStream.end(buffer);
  });
}

export function openUploadStream(filename: string, contentType: string) {
  return getBucket().openUploadStream(filename, {
    contentType,
  });
}

export function openDownloadStream(fileId: mongoose.Types.ObjectId) {
  return getBucket().openDownloadStream(fileId);
}

export async function deleteFile(fileId: mongoose.Types.ObjectId): Promise<void> {
  await getBucket().delete(fileId);
}

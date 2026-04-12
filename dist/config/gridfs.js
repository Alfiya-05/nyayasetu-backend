"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initGridFS = initGridFS;
exports.getBucket = getBucket;
exports.uploadToGridFS = uploadToGridFS;
exports.openUploadStream = openUploadStream;
exports.openDownloadStream = openDownloadStream;
exports.deleteFile = deleteFile;
const mongoose_1 = __importDefault(require("mongoose"));
let bucket;
function initGridFS() {
    const db = mongoose_1.default.connection.db;
    if (db) {
        bucket = new mongoose_1.default.mongo.GridFSBucket(db, { bucketName: 'uploads' });
        console.log('GridFS bucket initialized');
        return;
    }
    // Fallback: if connection isn't fully ready, wait for 'open'
    mongoose_1.default.connection.once('open', () => {
        bucket = new mongoose_1.default.mongo.GridFSBucket(mongoose_1.default.connection.db, {
            bucketName: 'uploads',
        });
        console.log('GridFS bucket initialized');
    });
}
function getBucket() {
    if (!bucket) {
        throw new Error('GridFS bucket not initialized. Ensure MongoDB is connected first.');
    }
    return bucket;
}
/**
 * Uploads a file buffer to GridFS and returns the stored ObjectId.
 */
function uploadToGridFS(buffer, filename, contentType) {
    return new Promise((resolve, reject) => {
        const uploadStream = getBucket().openUploadStream(filename, { contentType });
        uploadStream.on('error', reject);
        uploadStream.on('finish', () => resolve(uploadStream.id));
        uploadStream.end(buffer);
    });
}
function openUploadStream(filename, contentType) {
    return getBucket().openUploadStream(filename, {
        contentType,
    });
}
function openDownloadStream(fileId) {
    return getBucket().openDownloadStream(fileId);
}
async function deleteFile(fileId) {
    await getBucket().delete(fileId);
}

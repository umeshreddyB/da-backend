import mongoose from 'mongoose';
import './env.js';
import { startLocalMongo } from './localMongo.js';

function useLocalMongo(uri) {
  if (!uri || uri.trim() === 'local') return true;
  return /USERNAME|<db_password>|<password>|PASSWORD/i.test(uri);
}

export async function connectDB() {
  let uri = process.env.MONGO_URI;
  if (useLocalMongo(uri)) {
    uri = await startLocalMongo();
    process.env.MONGO_URI = uri;
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

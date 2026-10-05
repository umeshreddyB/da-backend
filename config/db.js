import mongoose from 'mongoose';
import './env.js';
import { startLocalMongo } from './localMongo.js';

function mongoPassword(uri) {
  const after = String(uri).split('://')[1] || '';
  const credentials = after.split('@')[0];
  const encoded = credentials.slice(credentials.indexOf(':') + 1);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function useLocalMongo(uri) {
  if (!uri || uri.trim() === 'local') return true;
  const password = mongoPassword(uri.trim());
  const user = (String(uri).split('://')[1] || '').split(':')[0];
  if (user === 'USERNAME') return true;
  return ['<db_password>', '<password>', 'password', 'PASSWORD'].includes(password);
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

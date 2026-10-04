import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/mongo');
const LOCAL_URI = 'mongodb://127.0.0.1:27018/datascience';
let server;

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}

export async function startLocalMongo() {
  if (server) return server.getUri('datascience');
  if (await portOpen(27018)) {
    console.log('Using the MongoDB already running on port 27018');
    return LOCAL_URI;
  }

  fs.mkdirSync(dbPath, { recursive: true });
  const lockFile = path.join(dbPath, 'mongod.lock');
  if (fs.existsSync(lockFile)) {
    const stat = fs.statSync(lockFile);
    if (stat.size === 0) fs.unlinkSync(lockFile);
  }

  server = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: 'wiredTiger',
      port: 27018,
    },
  });

  const uri = server.getUri('datascience');
  console.log('Local MongoDB ready (data kept in Backend/data/mongo)');
  return uri;
}

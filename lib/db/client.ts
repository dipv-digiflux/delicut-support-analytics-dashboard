import { MongoClient, Db, Collection } from "mongodb";
import { getConfig } from "@/lib/config";
import type {
  Conversation,
  User,
  SyncWindow,
  SyncCursor,
  ExtractBudget,
  SyncRun,
} from "./types";

declare global {
  var __freshchatMongoClient: MongoClient | undefined;
}

let clientPromise: Promise<MongoClient> | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  const cfg = getConfig();

  if (process.env.NODE_ENV === "development") {
    if (!global.__freshchatMongoClient) {
      global.__freshchatMongoClient = new MongoClient(cfg.MONGODB_URI, {
        maxPoolSize: cfg.MONGODB_MAX_POOL_SIZE,
        serverSelectionTimeoutMS: cfg.MONGODB_TIMEOUT_MS,
      });
    }
    if (!clientPromise) {
      clientPromise = global.__freshchatMongoClient.connect();
    }
    return clientPromise;
  }

  if (!clientPromise) {
    const client = new MongoClient(cfg.MONGODB_URI, {
      maxPoolSize: cfg.MONGODB_MAX_POOL_SIZE,
      serverSelectionTimeoutMS: cfg.MONGODB_TIMEOUT_MS,
    });
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const cfg = getConfig();
  const client = await getMongoClient();
  return client.db(cfg.MONGODB_DB);
}

export async function collections() {
  const db = await getDb();
  return {
    conversations: db.collection<Conversation>("conversations"),
    users: db.collection<User>("users"),
    syncWindows: db.collection<SyncWindow>("sync_windows"),
    syncState: db.collection<SyncCursor | ExtractBudget>("sync_state"),
    syncRuns: db.collection<SyncRun>("sync_runs"),
  };
}

export type Collections = Awaited<ReturnType<typeof collections>>;

export async function closeMongo(): Promise<void> {
  if (clientPromise) {
    const client = await clientPromise;
    await client.close();
    clientPromise = null;
    if (global.__freshchatMongoClient) {
      global.__freshchatMongoClient = undefined;
    }
  }
}

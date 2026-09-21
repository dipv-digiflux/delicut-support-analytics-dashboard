import { MongoClient, ObjectId, type Db } from "mongodb";
import { getConfig } from "@/lib/config";

export type PlatformMatchStatus =
  | "unconfigured"
  | "unmatched"
  | "ambiguous"
  | "matched";

export type PlatformSnapshot = {
  status: PlatformMatchStatus;
  customerId: string | null;
  phone: string | null;
  email: string | null;
  totalOrders: number | null;
  totalSpent: number | null;
  aov: number | null;
  subscriptionOrders: number | null;
  note: string;
};

const EMPTY: PlatformSnapshot = {
  status: "unconfigured",
  customerId: null,
  phone: null,
  email: null,
  totalOrders: null,
  totalSpent: null,
  aov: null,
  subscriptionOrders: null,
  note: "Set PLATFORM_MONGODB_URI to join chats to orders.",
};

let platformClient: MongoClient | null = null;
let platformDb: Db | null = null;

export function uaeLocalPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("971")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  const local = d.slice(-9);
  return local.length >= 8 ? local : null;
}

async function platformCollection() {
  const cfg = getConfig();
  const uri = (cfg.PLATFORM_MONGODB_URI || "").trim();
  if (!uri) return null;
  if (!platformClient) {
    platformClient = new MongoClient(uri, {
      maxPoolSize: 4,
      serverSelectionTimeoutMS: 4000,
    });
    await platformClient.connect();
    const dbName =
      (cfg.PLATFORM_MONGODB_DB || "").trim() ||
      uri.split("/").pop()?.split("?")[0] ||
      "";
    platformDb = platformClient.db(dbName || undefined);
  }
  const name = cfg.PLATFORM_CUSTOMER_COLLECTION || "customer";
  return platformDb!.collection(name);
}

function snapshotFromDoc(
  doc: Record<string, unknown>,
  status: PlatformMatchStatus,
  note: string,
): PlatformSnapshot {
  const orders =
    typeof doc.total_orders === "number"
      ? doc.total_orders
      : typeof doc.total_order === "number"
        ? doc.total_order
        : null;
  const spentVal =
    typeof doc.total_spent === "number" ? doc.total_spent : null;
  const sub =
    typeof doc.total_subscription_order === "number"
      ? doc.total_subscription_order
      : null;
  return {
    status,
    customerId: doc._id != null ? String(doc._id) : null,
    phone:
      typeof doc.phone_number === "string" ? doc.phone_number : null,
    email: typeof doc.email === "string" ? doc.email : null,
    totalOrders: orders,
    totalSpent: spentVal,
    aov: orders && spentVal && orders > 0 ? spentVal / orders : null,
    subscriptionOrders: sub,
    note,
  };
}

export async function lookupPlatformCustomer(identity: {
  phone?: string | null;
  email?: string | null;
  referenceId?: string | null;
}): Promise<PlatformSnapshot> {
  const col = await platformCollection().catch(() => null);
  if (!col) return EMPTY;

  const or: object[] = [];
  const ref = identity.referenceId?.trim();
  if (ref && ObjectId.isValid(ref) && ref.length === 24) {
    or.push({ _id: new ObjectId(ref) });
  }
  const local = uaeLocalPhone(identity.phone);
  if (local) {
    or.push({ phone_number: local });
    or.push({ phone_number: `0${local}` });
    or.push({ whatsapp_number: local });
  }
  const email = identity.email?.trim().toLowerCase();
  if (email && !email.includes("autocreatebyziwo")) {
    or.push({ email });
  }
  if (!or.length) {
    return {
      ...EMPTY,
      status: "unmatched",
      note: "No phone, email, or reference id to join on.",
    };
  }

  const hits = await col.find({ $or: or }).limit(5).toArray();
  if (hits.length === 0) {
    return {
      ...EMPTY,
      status: "unmatched",
      note: "No platform customer for this phone/email.",
    };
  }
  if (hits.length > 1) {
    return {
      ...snapshotFromDoc(hits[0] as Record<string, unknown>, "ambiguous", ""),
      status: "ambiguous",
      note: `${hits.length} platform customers matched — not attaching.`,
    };
  }
  return snapshotFromDoc(
    hits[0] as Record<string, unknown>,
    "matched",
    "Joined on phone / email / reference id.",
  );
}

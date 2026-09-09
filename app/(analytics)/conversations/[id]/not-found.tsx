import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-6 py-16 text-center">
      <h1 className="text-xl font-bold">Conversation not found</h1>
      <Link
        href="/conversations"
        className="mt-4 inline-block text-[var(--brand)]"
      >
        ← Conversations
      </Link>
    </div>
  );
}

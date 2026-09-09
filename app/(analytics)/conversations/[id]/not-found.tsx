import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        Conversation not found
      </h1>
      <Link href="/conversations" className="mt-4 inline-block text-blue-600">
        Back to conversations
      </Link>
    </div>
  );
}

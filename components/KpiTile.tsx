import Link from "next/link";
import { InfoTip } from "@/components/ui/InfoTip";

export function SectionTitle({
  children,
  tip,
}: {
  children: React.ReactNode;
  tip?: string;
}) {
  return (
    <h2 className="mb-3 flex items-center text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
      {children}
      {tip && <InfoTip text={tip} />}
    </h2>
  );
}

export function KpiTile({
  label,
  value,
  footnote,
  tip,
  href,
}: {
  label: string;
  value: string;
  footnote?: string;
  tip?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div className="mt-0.5 text-lg font-semibold text-[var(--brand-ink)]">
        {value}
      </div>
      {footnote && (
        <div className="mt-0.5 text-[10px] text-[var(--muted)]">{footnote}</div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-[var(--border)] bg-white p-2.5 transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
        title="Open matching conversations"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-2.5">
      {inner}
    </div>
  );
}

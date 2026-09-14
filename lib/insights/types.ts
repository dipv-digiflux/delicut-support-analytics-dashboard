export type InsightPersona = "cx" | "marketing";

export type InsightSeverity = "high" | "medium" | "low";

export type InsightAction = {
  id: string;
  persona: InsightPersona | "both";
  severity: InsightSeverity;
  title: string;
  why: string;
  next: string;
  href: string;
};

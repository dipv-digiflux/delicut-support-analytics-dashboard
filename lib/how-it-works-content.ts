export const HOW_IT_WORKS_INTRO =
  "Read-only Freshchat warehouse: Extract CSV → local Mongo → this UI. We do not invent CSAT, agent tags, or SLA seconds. Keyword classify writes derived only — never back to Freshchat.";

export const HOW_IT_WORKS_SCREENS: {
  name: string;
  path: string;
  answers: string;
  honesty: string;
}[] = [
  {
    name: "Dashboard",
    path: "/dashboard",
    answers: "Volume, CSAT, FRT, labels, 1–2★ reasons",
    honesty: "Two CSAT denominators. Label coverage = Freshchat tags only.",
  },
  {
    name: "Conversations",
    path: "/conversations",
    answers: "Raw rows behind any tile",
    honesty: "kw = keyword inferred. Filter Subject source.",
  },
  {
    name: "Chat",
    path: "/conversations",
    answers: "Transcript + Account / orders",
    honesty: "Orders stay unmatched until platform Mongo.",
  },
  {
    name: "Customers",
    path: "/users",
    answers: "People + their chats",
    honesty: "Same Account snapshot as chat.",
  },
  {
    name: "Experience",
    path: "/insights/cx",
    answers: "Five CX briefing checks",
    honesty: "Copy frozen.",
  },
  {
    name: "Demand",
    path: "/insights/marketing",
    answers: "Five CMO briefing checks",
    honesty: "Copy frozen.",
  },
  {
    name: "Chat risk",
    path: "/outcomes",
    answers: "Pause / cancel / refund language vs CSAT / FRT",
    honesty: "Not subscription non-renewal.",
  },
  {
    name: "Phone Sales",
    path: "/sales",
    answers: "Phone-ZIWO chats",
    honesty: "Not dialer CRM. Connect / talk / revenue stay —.",
  },
  {
    name: "Data flow",
    path: "/data-flow",
    answers: "What Extract events are in Mongo",
    honesty: "UI is as fresh as last sync.",
  },
];

export const HOW_IT_WORKS_KPIS: {
  title: string;
  rows: { label: string; meaning: string }[];
}[] = [
  {
    title: "CSAT",
    rows: [
      {
        label: "Response rate",
        meaning: "Rated ÷ all chats. Includes chats that never got a survey. Do not compare to industry 20–30%.",
      },
      {
        label: "CSAT on resolved",
        meaning: "Rated among resolved ÷ resolved. Closer to survey completion if CSAT fires on resolve.",
      },
      {
        label: "Avg / satisfied / dissatisfied",
        meaning: "Among rated only. Dissatisfied = ≤2. Board on Dashboard is last 50 of those chats.",
      },
    ],
  },
  {
    title: "First response",
    rows: [
      {
        label: "Median vs avg vs p90",
        meaning: "Typical wait vs mean (skewed) vs slow tail. Seconds come from Extract, not guessed.",
      },
      {
        label: "% FRT > 2 min",
        meaning: "Share with FRT ≥ 120s. Histogram is 1–2m then 2–5m so the SLA is visible.",
      },
    ],
  },
  {
    title: "Labels",
    rows: [
      {
        label: "Label coverage",
        meaning: "Non-empty Freshchat agent tag ÷ chats. Keyword never counts here.",
      },
      {
        label: "Derived coverage",
        meaning: "Agent tag, or keyword if classify is on. Filter Subject source to inspect inferred rows.",
      },
    ],
  },
];

export interface KeywordPattern {
  re: RegExp;
  weight: number;
}

export interface TaxonomyEntry {
  key: string;
  label: string;
  patterns: KeywordPattern[];
  negative?: RegExp[];
}

export const TAXONOMY: TaxonomyEntry[] = [
  {
    key: "billing.refund",
    label: "Refund Request",
    patterns: [
      { re: /\brefund(ed|ing)?\b/i, weight: 3 },
      { re: /\bmoney back\b/i, weight: 3 },
      { re: /\bcharged?\s+twice\b/i, weight: 2 },
      { re: /\bduplicate\s+charge\b/i, weight: 2 },
    ],
    negative: [/\brefund policy\b/i],
  },
  {
    key: "billing",
    label: "Billing",
    patterns: [
      { re: /\bbilling\b/i, weight: 3 },
      { re: /\binvoice\b/i, weight: 2 },
      { re: /\bpayment\b/i, weight: 2 },
      { re: /\bcharge[sd]?\b/i, weight: 1 },
    ],
  },
  {
    key: "orders.cancel",
    label: "Cancel Order",
    patterns: [
      { re: /\bcancel(l?ed|l?ing)?\b/i, weight: 3 },
      { re: /\bcancel.{0,20}order\b/i, weight: 3 },
    ],
  },
  {
    key: "orders.status",
    label: "Order Status",
    patterns: [
      { re: /\border status\b/i, weight: 3 },
      { re: /\bwhere is my order\b/i, weight: 3 },
      { re: /\btrack(ing)?\b/i, weight: 2 },
    ],
  },
  {
    key: "shipping",
    label: "Shipping / Delivery",
    patterns: [
      { re: /\bshipping\b/i, weight: 3 },
      { re: /\bdelivery\b/i, weight: 3 },
      { re: /\bcourier\b/i, weight: 2 },
      { re: /\bnot received\b/i, weight: 2 },
    ],
  },
  {
    key: "account.login",
    label: "Login / Access",
    patterns: [
      { re: /\blog\s?in\b/i, weight: 3 },
      { re: /\bpassword\b/i, weight: 3 },
      { re: /\botp\b/i, weight: 2 },
      { re: /\bcannot access\b/i, weight: 2 },
    ],
  },
  {
    key: "technical",
    label: "Technical Issue",
    patterns: [
      { re: /\berror\b/i, weight: 2 },
      { re: /\bbug\b/i, weight: 2 },
      { re: /\bnot working\b/i, weight: 3 },
      { re: /\bcrash(ed|ing)?\b/i, weight: 2 },
      { re: /\bapp\b/i, weight: 1 },
    ],
  },
  {
    key: "complaint",
    label: "Complaint",
    patterns: [
      { re: /\bcomplaint\b/i, weight: 3 },
      { re: /\bunhappy\b/i, weight: 2 },
      { re: /\bfrustrated\b/i, weight: 2 },
      { re: /\bterrible\b/i, weight: 2 },
    ],
  },
];

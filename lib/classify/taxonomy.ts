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
    key: "plan.pause",
    label: "Pause / skip plan",
    patterns: [
      { re: /\bpause\b/i, weight: 3 },
      { re: /\bskip\b/i, weight: 3 },
      { re: /\bhold (my )?plan\b/i, weight: 2 },
      { re: /\btravel(l?ing)?\b/i, weight: 2 },
      { re: /\bout of (the )?country\b/i, weight: 3 },
      { re: /\bpostpone\b/i, weight: 2 },
    ],
  },
  {
    key: "plan.renew",
    label: "Renew / continue",
    patterns: [
      { re: /\brenew(al|ing)?\b/i, weight: 3 },
      { re: /\bnot renewing\b/i, weight: 3 },
      { re: /\bsubscription has ended\b/i, weight: 3 },
    ],
  },
  {
    key: "plan.change",
    label: "Change plan / meals",
    patterns: [
      { re: /\bchange (my )?(plan|subscription|meals?)\b/i, weight: 3 },
      { re: /\bupgrade\b/i, weight: 2 },
      { re: /\bdowngrade\b/i, weight: 2 },
      { re: /\bmonthly\b/i, weight: 1 },
      { re: /\bcalories?\b/i, weight: 3 },
      { re: /\bportion\b/i, weight: 2 },
    ],
  },
  {
    key: "meal.swap",
    label: "Swap / change meal",
    patterns: [
      { re: /\bswap\b/i, weight: 3 },
      { re: /\bchange (my )?(lunch|dinner|breakfast)\b/i, weight: 3 },
      { re: /\bchange dinner\b/i, weight: 3 },
      { re: /\bmenu\b/i, weight: 1 },
    ],
  },
  {
    key: "trial",
    label: "Trial",
    patterns: [
      { re: /\btrial\b/i, weight: 3 },
      { re: /\bfree box\b/i, weight: 2 },
    ],
  },
  {
    key: "quality",
    label: "Food quality",
    patterns: [
      { re: /\bspoil(ed|ing)?\b/i, weight: 3 },
      { re: /\btaste\b/i, weight: 2 },
      { re: /\bsmell\b/i, weight: 2 },
      { re: /\bquality\b/i, weight: 2 },
      { re: /\brott?en\b/i, weight: 3 },
      { re: /\buncooked\b/i, weight: 3 },
      { re: /\bplastic in (the )?food\b/i, weight: 3 },
    ],
  },
  {
    key: "missing",
    label: "Missing / wrong item",
    patterns: [
      { re: /\bmissing\b/i, weight: 3 },
      { re: /\bwrong (item|meal|order|box)\b/i, weight: 3 },
      { re: /\bincomplete\b/i, weight: 2 },
    ],
  },
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
      { re: /\bdelivery\b/i, weight: 2 },
      { re: /\bcourier\b/i, weight: 2 },
      { re: /\bnot received\b/i, weight: 3 },
      { re: /\bdidn'?t receive\b/i, weight: 3 },
      { re: /\bdid not receive\b/i, weight: 3 },
      { re: /\bnever received\b/i, weight: 3 },
      { re: /\bnot delivered\b/i, weight: 3 },
      { re: /\bdidn'?t arrive\b/i, weight: 3 },
    ],
  },
  {
    key: "delivery.timing",
    label: "Delivery timing",
    patterns: [
      { re: /\btoo early\b/i, weight: 3 },
      { re: /\bdelivery (time|slot|timing)\b/i, weight: 3 },
      { re: /\bprepone\b/i, weight: 3 },
    ],
  },
  {
    key: "address",
    label: "Address change",
    patterns: [
      { re: /\baddress\b/i, weight: 3 },
      { re: /\bold address\b/i, weight: 3 },
      { re: /\bchange (the )?location\b/i, weight: 3 },
    ],
  },
  {
    key: "bags",
    label: "Bag return / deposit",
    patterns: [
      { re: /\bbag deposit\b/i, weight: 3 },
      { re: /\breturn (the )?(delivery )?bag\b/i, weight: 3 },
      { re: /\bcollect the bag\b/i, weight: 2 },
    ],
  },
  {
    key: "promo",
    label: "Promo / discount",
    patterns: [
      { re: /\bpromo( ?code)?\b/i, weight: 3 },
      { re: /\bdiscount\b/i, weight: 3 },
      { re: /\bfazaa\b/i, weight: 3 },
      { re: /\bcoupon\b/i, weight: 2 },
      { re: /\bcodes? (are )?not working\b/i, weight: 3 },
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

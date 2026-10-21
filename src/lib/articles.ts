export interface Article {
  slug: string;
  title: string;
  kind: "Guide" | "Report";
  summary: string;
  body: string[];
}
export const articles: Article[] = [
  {
    slug: "what-is-gmp",
    title: "What is grey market premium (GMP)?",
    kind: "Guide",
    summary: "How the unofficial grey market works and why GMP should never be your only signal.",
    body: [
      "Grey market premium is the price above the issue price at which IPO shares are informally traded before listing. It is unregulated and not backed by any exchange.",
      "GMP reflects short-term sentiment. It can move sharply within hours and frequently diverges from actual listing prices.",
      "Use GMP alongside subscription demand, company financials and valuation, never as a standalone indicator.",
    ],
  },
  {
    slug: "how-to-apply",
    title: "How to apply for an IPO through UPI",
    kind: "Guide",
    summary: "A step-by-step guide to bidding via your broker or bank ASBA.",
    body: [
      "Log in to your broker or net banking, pick the IPO and choose the number of lots.",
      "Enter your UPI ID and approve the mandate request in your UPI app before the cut-off time on the closing day.",
      "Funds stay blocked in your account until allotment. If you are not allotted shares, the block is released.",
    ],
  },
  {
    slug: "reading-subscription",
    title: "Reading subscription data by category",
    kind: "Guide",
    summary: "What QIB, NII and retail subscription numbers tell you.",
    body: [
      "QIB (qualified institutional buyers) demand is often viewed as a signal of institutional conviction.",
      "NII (non-institutional investors) includes HNIs and is frequently leveraged, making it volatile.",
      "Retail subscription shows individual investor demand and directly affects your allotment probability.",
    ],
  },
  {
    slug: "listing-performance-review",
    title: "Listing performance review: last 30 days",
    kind: "Report",
    summary: "How recent IPOs listed against issue price and pre-listing GMP.",
    body: [
      "Listing performance is available from the Listings page when source-backed observations are available.",
      "Subscription demand and listing performance describe different stages of an issue; neither guarantees future returns.",
      "Read source attribution and observation dates alongside every figure.",
    ],
  },
];

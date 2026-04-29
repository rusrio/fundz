import type { FundingChallenge } from "../types.js";

export const fundingChallenges: FundingChallenge[] = [
  {
    name: "Starter",
    phase: "Phase 1 Evaluation",
    allocation: "$100,000",
    profitTarget: "8%",
    maxDrawdown: "10%",
    dailyDrawdown: "5%",
    timeLimit: "30 days",
    action: "Start challenge"
  },
  {
    name: "Professional",
    phase: "Phase 1 Evaluation",
    allocation: "$250,000",
    profitTarget: "10%",
    maxDrawdown: "12%",
    dailyDrawdown: "5%",
    timeLimit: "60 days",
    action: "Start challenge",
    featured: true
  },
  {
    name: "Institutional",
    phase: "Direct Funding",
    allocation: "$1,000,000",
    profitTarget: "12%",
    maxDrawdown: "8%",
    dailyDrawdown: "4%",
    timeLimit: "Unlimited",
    action: "Apply now"
  }
];

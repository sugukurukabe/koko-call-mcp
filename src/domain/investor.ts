import { z } from "zod";
import { AttributionSchema } from "./attribution.js";
import { BidSchema } from "./bid.js";
import {
  INVESTMENT_DISCLAIMER,
  JquantsAttributionSchema,
  ListedCompanySchema,
  ListedMatchSchema,
} from "./listed-company.js";

export const MappedAwardSchema = z.object({
  bid: BidSchema,
  matches: z.array(ListedMatchSchema),
});

export const ListedAwardFactsSchema = z.object({
  company: ListedCompanySchema,
  noticeCount: z.number().int().nonnegative(),
  latestNoticeDate: z.string().nullable(),
  latestNoticeKey: z.string().nullable(),
  prefectureBreakdown: z.record(z.string(), z.number()),
  categoryBreakdown: z.record(z.string(), z.number()),
  noticeKeys: z.array(z.string()),
});

export const AwardMappingResultSchema = z.object({
  searchHits: z.number().int().nonnegative(),
  returnedCount: z.number().int().nonnegative(),
  mappedCount: z.number().int().nonnegative(),
  unmappedCount: z.number().int().nonnegative(),
  mapped: z.array(MappedAwardSchema),
  companies: z.array(ListedAwardFactsSchema),
  catalogSource: z.enum(["bundled", "jquants"]),
  caveats: z.array(z.string()),
  investmentDisclaimer: z.literal(INVESTMENT_DISCLAIMER),
  attribution: AttributionSchema,
  jquantsAttribution: JquantsAttributionSchema.optional(),
});

export type AwardMappingResult = z.infer<typeof AwardMappingResultSchema>;

export const ListedAwardHistorySchema = z.object({
  company: ListedCompanySchema,
  windowDays: z.number().int().positive(),
  noticeCount: z.number().int().nonnegative(),
  latestNoticeDate: z.string().nullable(),
  latestNoticeKey: z.string().nullable(),
  prefectureBreakdown: z.record(z.string(), z.number()),
  categoryBreakdown: z.record(z.string(), z.number()),
  bids: z.array(BidSchema),
  caveats: z.array(z.string()),
  investmentDisclaimer: z.literal(INVESTMENT_DISCLAIMER),
  attribution: AttributionSchema,
});

export type ListedAwardHistory = z.infer<typeof ListedAwardHistorySchema>;

export const DailyBarSchema = z.object({
  date: z.string(),
  code: z.string(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  close: z.number().nullable(),
  volume: z.number().nullable(),
  adjustmentClose: z.number().nullable(),
});

export const AwardPriceImpactSchema = z.object({
  company: ListedCompanySchema,
  eventDate: z.string(),
  bidKey: z.string().optional(),
  projectName: z.string().optional(),
  windowDays: z.number().int().positive(),
  from: z.string(),
  to: z.string(),
  closeAtOrBeforeEvent: z.number().nullable(),
  closeAtOrAfterWindowEnd: z.number().nullable(),
  pctChange: z.number().nullable(),
  bars: z.array(DailyBarSchema),
  caveats: z.array(z.string()),
  investmentDisclaimer: z.literal(INVESTMENT_DISCLAIMER),
  attribution: AttributionSchema,
  jquantsAttribution: JquantsAttributionSchema,
});

export type AwardPriceImpact = z.infer<typeof AwardPriceImpactSchema>;

export const WatchListedAwardsSchema = z.object({
  action: z.enum(["save", "check", "list"]),
  watchlist: z.array(
    z.object({
      name: z.string(),
      query: z.string(),
      code: z.string().optional(),
      createdAt: z.string(),
      lastCheckedAt: z.string().nullable(),
    }),
  ),
  newNoticesCount: z.number().int().nonnegative().optional(),
  newNotices: z
    .array(
      z.object({
        key: z.string(),
        projectName: z.string(),
        query: z.string(),
        cftIssueDate: z.string().nullable(),
      }),
    )
    .optional(),
  stateToken: z.string(),
  nextStep: z.string(),
  investmentDisclaimer: z.literal(INVESTMENT_DISCLAIMER),
  attribution: AttributionSchema,
});

export type WatchListedAwards = z.infer<typeof WatchListedAwardsSchema>;

import { z } from "zod";
import { AttributionSchema } from "./attribution.js";
import { CategorySchema, ProcedureTypeSchema } from "./codes.js";

export const AttachmentSchema = z.object({
  name: z.string(),
  uri: z.string().url().or(z.string().min(1)),
});

export const BidSchema = z.object({
  resultId: z.number().int().nonnegative(),
  key: z.string().min(1),
  externalDocumentUri: z.string().optional(),
  projectName: z.string().min(1),
  date: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().nonnegative().optional(),
  lgCode: z.string().optional(),
  prefectureName: z.string().optional(),
  cityCode: z.string().optional(),
  cityName: z.string().optional(),
  organizationName: z.string().optional(),
  certification: z.string().optional(),
  cftIssueDate: z.string().optional(),
  periodEndTime: z.string().optional(),
  category: CategorySchema.or(z.string()).optional(),
  procedureType: ProcedureTypeSchema.or(z.string()).optional(),
  location: z.string().optional(),
  tenderSubmissionDeadline: z.string().optional(),
  openingTendersEvent: z.string().optional(),
  itemCode: z.string().optional(),
  projectDescription: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

export type Bid = z.infer<typeof BidSchema>;

export const BidSearchResultSchema = z.object({
  searchHits: z.number().int().nonnegative(),
  returnedCount: z.number().int().nonnegative(),
  bids: z.array(BidSchema),
  query: z.record(z.string(), z.union([z.string(), z.number()])),
  attribution: AttributionSchema,
});

export type BidSearchResult = z.infer<typeof BidSearchResultSchema>;

export const OrganizationSummarySchema = z.object({
  organizationName: z.string(),
  totalHits: z.number().int().nonnegative(),
  returnedCount: z.number().int().nonnegative(),
  categories: z.record(z.string(), z.number().int().nonnegative()),
  procedureTypes: z.record(z.string(), z.number().int().nonnegative()),
  recentProjects: z.array(BidSchema),
  attribution: AttributionSchema,
});

export type OrganizationSummary = z.infer<typeof OrganizationSummarySchema>;

import { z } from 'zod';

// Explicit projections of customerFeedback_2024-06-01.json (model commit 713565ff).
// Free-text review snippets and unknown response keys are never returned.
const DateRange = z.object({ startDate: z.string().optional(), endDate: z.string().optional() });
const BrowsePercentage = z.object({ allProducts: z.number().optional(), topTwentyFivePercentProducts: z.number().optional() });
const BrowseMetrics = z.object({ occurrencePercentage: BrowsePercentage.optional(), starRatingImpact: BrowsePercentage.optional() });
const ItemMetrics = z.object({ numberOfMentions: z.number().optional(), occurrencePercentage: z.number().optional(), starRatingImpact: z.number().optional() });
const ItemTopic = z.object({ asinMetrics: ItemMetrics.optional(), parentAsinMetrics: ItemMetrics.optional() });
const BrowseTopic = z.object({ browseNodeMetrics: BrowseMetrics.optional() });
const TopicGroups = (topic: z.ZodTypeAny) => z.object({ positiveTopics: z.array(topic).max(100).nullable().optional(), negativeTopics: z.array(topic).max(100).nullable().optional() });
const Base = {
    asin: z.string().optional(), browseNodeId: z.string().optional(), marketplaceId: z.string().optional(),
    countryCode: z.string().optional(), dateRange: DateRange.optional()
};
export const ItemReviewTopicsOutput = z.object({ ...Base, topics: TopicGroups(ItemTopic).optional() });
export const BrowseReviewTopicsOutput = z.object({ ...Base, topics: TopicGroups(BrowseTopic).optional() });
const TrendPoint = z.object({ dateRange: DateRange.optional(), asinMetrics: z.object({ occurrencePercentage: z.number().optional() }).optional(), parentAsinMetrics: z.object({ occurrencePercentage: z.number().optional() }).optional() });
const TrendTopic = z.object({ trendMetrics: z.array(TrendPoint).max(100).optional() });
export const ItemReviewTrendsOutput = z.object({ ...Base, reviewTrends: TopicGroups(TrendTopic).optional() });
const ReturnTopic = z.object({ browseNodeMetrics: z.object({ occurrencePercentage: BrowsePercentage.optional() }).optional() });
export const BrowseReturnTopicsOutput = z.object({ ...Base, topics: z.array(ReturnTopic).max(100).optional() });
const ReturnTrend = z.object({ trendMetrics: z.array(z.object({ dateRange: DateRange.optional(), browseNodeMetrics: z.object({ occurrencePercentage: BrowsePercentage.optional() }).optional() })).max(100).optional() });
export const BrowseReturnTrendsOutput = z.object({ ...Base, returnTrends: z.array(ReturnTrend).max(100).optional() });

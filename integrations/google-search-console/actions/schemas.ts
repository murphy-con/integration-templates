import { z } from 'zod';

// Search Console resource representations: https://developers.google.com/webmaster-tools/v1/api_reference_index
export const SiteSchema = z.object({
    siteUrl: z.string(),
    permissionLevel: z.string()
});
export const SitesSchema = z.object({ siteEntry: z.array(SiteSchema).optional() }).strict();

export const SitemapSchema = z.object({
    path: z.string(),
    lastSubmitted: z.string().optional(),
    isPending: z.boolean().optional(),
    isSitemapsIndex: z.boolean().optional(),
    type: z.string().optional(),
    lastDownloaded: z.string().optional(),
    warnings: z.string().or(z.number()).optional(),
    errors: z.string().or(z.number()).optional(),
    contents: z
        .array(z.object({ type: z.string().optional(), submitted: z.string().or(z.number()).optional(), indexed: z.string().or(z.number()).optional() }))
        .optional()
});
export const SitemapsSchema = z.object({ sitemap: z.array(SitemapSchema).optional() }).strict();

export const AnalyticsSchema = z
    .object({
        rows: z
            .array(
                z.object({
                    keys: z.array(z.string()).optional(),
                    clicks: z.number().optional(),
                    impressions: z.number().optional(),
                    ctr: z.number().optional(),
                    position: z.number().optional()
                })
            )
            .optional(),
        responseAggregationType: z.string().optional(),
        metadata: z.object({ first_incomplete_date: z.string().optional(), first_incomplete_hour: z.string().optional() }).optional()
    })
    .strict();

// Inspection has many evolving issue subtypes; validate the documented envelope
// and preserve nested diagnostic fields instead of silently discarding them.
export const InspectionSchema = z.object({
    inspectionResult: z
        .object({
            inspectionResultLink: z.string().optional(),
            indexStatusResult: z.object({ coverageState: z.string().optional() }).passthrough().optional(),
            ampResult: z.object({}).passthrough().optional(),
            mobileUsabilityResult: z.object({}).passthrough().optional(),
            richResultsResult: z.object({}).passthrough().optional()
        })
        .passthrough()
});

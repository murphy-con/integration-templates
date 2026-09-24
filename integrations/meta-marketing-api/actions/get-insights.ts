import { createAction } from 'nango';
import { z } from 'zod';

const InputSchema = z.strictObject({
    ad_account_id: z.string().regex(/^(?:act_)?\d{1,64}$/),
    date_preset: z.enum(['today', 'yesterday', 'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'this_month', 'last_month']).default('last_7d'),
    level: z.enum(['account', 'campaign', 'adset', 'ad']).default('campaign'),
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().min(1).max(512).optional()
});

const InsightSchema = z.object({
    account_id: z.string().optional(),
    campaign_id: z.string().optional(),
    campaign_name: z.string().optional(),
    adset_id: z.string().optional(),
    adset_name: z.string().optional(),
    ad_id: z.string().optional(),
    ad_name: z.string().optional(),
    date_start: z.string().optional(),
    date_stop: z.string().optional(),
    impressions: z.string().optional(),
    clicks: z.string().optional(),
    spend: z.string().optional(),
    reach: z.string().optional(),
    actions: z.array(z.object({ action_type: z.string(), value: z.string() })).optional()
});

const OutputSchema = z.object({
    data: z.array(InsightSchema),
    paging: z.object({ cursors: z.object({ before: z.string().optional(), after: z.string().optional() }).optional() }).optional()
});

function normalizeAdAccountId(value: string): string {
    return value.startsWith('act_') ? value.slice(4) : value;
}

export default createAction({
    description: 'Read bounded Meta Ads Insights for one accessible ad account.',
    version: '2.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_read'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const response = await nango.get({
            endpoint: `/v26.0/act_${encodeURIComponent(normalizeAdAccountId(input.ad_account_id))}/insights`,
            retries: 3,
            params: {
                fields: 'account_id,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,date_stop,impressions,clicks,spend,reach,actions',
                date_preset: input.date_preset,
                level: input.level,
                limit: String(input.limit ?? 100),
                ...(input.after !== undefined && { after: input.after })
            }
        });
        return OutputSchema.parse(response.data);
    }
});

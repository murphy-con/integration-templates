import { createAction } from 'nango';
import { z } from 'zod';

const Id = z.string().regex(/^\d{1,64}$/);
const TargetingSchema = z.object({
    geo_locations: z.object({
        countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(50)
    }),
    age_min: z.number().int().min(13).max(65).optional(),
    age_max: z.number().int().min(13).max(65).optional()
}).refine(value => value.age_min === undefined || value.age_max === undefined || value.age_min <= value.age_max, {
    message: 'age_min must not exceed age_max'
});
const InputSchema = z.object({
    ad_account_id: Id,
    campaign_id: Id,
    name: z.string().trim().min(1).max(255),
    daily_budget: z.number().int().min(100).max(100000000).optional(),
    lifetime_budget: z.number().int().min(100).max(1000000000).optional(),
    billing_event: z.enum(['IMPRESSIONS', 'LINK_CLICKS', 'POST_ENGAGEMENT', 'THRUPLAY']),
    optimization_goal: z.enum(['REACH', 'IMPRESSIONS', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'POST_ENGAGEMENT', 'LEAD_GENERATION', 'OFFSITE_CONVERSIONS', 'THRUPLAY']),
    targeting: TargetingSchema
}).refine(value => (value.daily_budget === undefined) !== (value.lifetime_budget === undefined), {
    message: 'Provide exactly one budget type'
});
const OutputSchema = z.object({ id: Id });

export default createAction({
    description: 'Create a paused Meta ad set with bounded targeting and budget.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_management'],
    exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
        const response = await nango.post({
            endpoint: `/v26.0/act_${input.ad_account_id}/adsets`,
            data: {
                name: input.name,
                campaign_id: input.campaign_id,
                billing_event: input.billing_event,
                optimization_goal: input.optimization_goal,
                targeting: input.targeting,
                ...(input.daily_budget !== undefined ? { daily_budget: input.daily_budget } : {}),
                ...(input.lifetime_budget !== undefined ? { lifetime_budget: input.lifetime_budget } : {}),
                status: 'PAUSED'
            }
        });
        return OutputSchema.parse(response.data);
    }
});

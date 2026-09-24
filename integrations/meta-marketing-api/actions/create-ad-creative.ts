import { createAction } from 'nango';
import { z } from 'zod';

// Non-idempotent mutations must never be replayed after an ambiguous failure.
const NO_WRITE_RETRIES = 0;

const Id = z.string().regex(/^\d{1,64}$/);
const InputSchema = z.strictObject({
    ad_account_id: Id,
    name: z.string().trim().min(1).max(255),
    page_id: Id,
    link_url: z.string().url().max(2048),
    message: z.string().trim().min(1).max(5000),
    headline: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(255).optional(),
    image_hash: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    call_to_action_type: z.enum(['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'CONTACT_US', 'DOWNLOAD']).optional()
});
const OutputSchema = z.object({ id: Id });

export default createAction({
    description: 'Create a link-based Meta ad creative for an accessible Page.',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['ads_management'],
    exec: async (nango, rawInput): Promise<z.infer<typeof OutputSchema>> => {
        const input = InputSchema.parse(rawInput);
        const linkData = {
            link: input.link_url,
            message: input.message,
            ...(input.headline !== undefined ? { name: input.headline } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.image_hash !== undefined ? { image_hash: input.image_hash } : {}),
            ...(input.call_to_action_type !== undefined ? { call_to_action: { type: input.call_to_action_type, value: { link: input.link_url } } } : {})
        };
        const response = await nango.post({ retries: NO_WRITE_RETRIES,
            endpoint: `/v26.0/act_${input.ad_account_id}/adcreatives`,
            data: { name: input.name, object_story_spec: { page_id: input.page_id, link_data: linkData } }
        });
        return OutputSchema.parse(response.data);
    }
});

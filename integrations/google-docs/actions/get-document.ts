import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z
    .object({ documentId: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).describe('Google Docs document ID.') })
    .strict();

const OutputSchema = z
    .object({
        documentId: z.string(),
        title: z.string().optional(),
        revisionId: z.string().optional(),
        suggestionsViewMode: z.string().optional()
    });

const action = createAction({
    description: 'Get selected Google Docs document metadata by ID (without document content)',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
        // https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get
        const response = await nango.get({
            endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}`,
            params: { fields: 'documentId,title,revisionId,suggestionsViewMode' },
            retries: 3
        });
        return OutputSchema.parse(response.data);
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;

import { z } from 'zod';
import { createAction } from 'nango';

const InputSchema = z.object({ fileId: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).describe('Google Drive file ID.') }).strict();

const OutputSchema = z
    .object({
        id: z.string(),
        name: z.string().optional(),
        mimeType: z.string().optional(),
        description: z.string().optional(),
        parents: z.array(z.string()).optional(),
        modifiedTime: z.string().optional(),
        createdTime: z.string().optional(),
        size: z.string().optional(),
        webViewLink: z.string().optional(),
        trashed: z.boolean().optional(),
        starred: z.boolean().optional(),
        driveId: z.string().optional()
    });

const action = createAction({
    description: 'Get metadata for a Google Drive file by ID',
    version: '1.0.0',
    input: InputSchema,
    output: OutputSchema,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    exec: async (nango, input): Promise<z.infer<typeof OutputSchema>> => {
        // https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get
        const response = await nango.get({
            endpoint: `/drive/v3/files/${encodeURIComponent(input.fileId)}`,
            params: {
                supportsAllDrives: 'true',
                fields: 'id,name,mimeType,description,parents,modifiedTime,createdTime,size,webViewLink,trashed,starred,driveId'
            },
            retries: 3
        });
        return OutputSchema.parse(response.data);
    }
});

export type NangoActionLocal = Parameters<(typeof action)['exec']>[0];
export default action;

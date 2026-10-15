import { describe, expect, it, vi } from 'vitest';
import getDocument from '../actions/get-document.js';
import getFileMetadata from '../../google-drive/actions/get-file-metadata.js';

describe('Google Workspace read-only actions', () => {
    it('gets a document by validated ID and returns only approved metadata', async () => {
        const document = { documentId: 'doc_1', title: 'Notes' };
        const get = vi.fn().mockResolvedValue({ data: document });
        const input = getDocument.input.parse({ documentId: 'doc_1' });
        const result = await getDocument.exec({ get } as never, input);
        expect(get).toHaveBeenCalledWith({ endpoint: '/v1/documents/doc_1', params: { fields: 'documentId,title,revisionId,suggestionsViewMode' }, retries: 3 });
        expect(getDocument.output.parse(result)).toEqual(document);
    });

    it('excludes unreviewed document content and provider fields', async () => {
        const data = { documentId: 'doc_1', title: 'Notes', body: { content: [{ paragraph: { elements: [{ textRun: { content: 'secret' } }] } }] }, tabs: [{ tabProperties: { tabId: 't1' } }], owners: ['private'] };
        const get = vi.fn().mockResolvedValue({ data });
        const result = await getDocument.exec({ get } as never, { documentId: 'doc_1' });
        expect(result).toEqual({ documentId: 'doc_1', title: 'Notes' });
        expect(getDocument.output.parse(data)).toEqual(result);
    });

    it('rejects invalid document IDs and malformed provider responses', async () => {
        expect(() => getDocument.input.parse({ documentId: '../other' })).toThrow();
        expect(() => getDocument.input.parse({ documentId: 'doc', endpoint: '/evil' })).toThrow();
        const get = vi.fn().mockResolvedValue({ data: { title: 'missing id' } });
        await expect(getDocument.exec({ get } as never, { documentId: 'doc' })).rejects.toThrow();
        get.mockResolvedValue({ data: { documentId: 'doc', revisionId: 123 } });
        await expect(getDocument.exec({ get } as never, { documentId: 'doc' })).rejects.toThrow();
    });

    it('gets selected Drive file metadata with shared-drive support', async () => {
        const file = { id: 'file-1', name: 'Report', mimeType: 'application/pdf', size: '12', webViewLink: 'https://drive.google.com/file' };
        const get = vi.fn().mockResolvedValue({ data: file });
        const input = getFileMetadata.input.parse({ fileId: 'file-1' });
        const result = await getFileMetadata.exec({ get } as never, input);
        expect(get).toHaveBeenCalledWith({
            endpoint: '/drive/v3/files/file-1',
            params: {
                supportsAllDrives: 'true',
                fields: 'id,name,mimeType,description,parents,modifiedTime,createdTime,size,webViewLink,trashed,starred,driveId'
            },
            retries: 3
        });
        expect(getFileMetadata.output.parse(result)).toEqual(file);
    });

    it('excludes unreviewed Drive fields from a provider response', async () => {
        const data = { id: 'file-1', name: 'Report', properties: { private: 'secret' }, owners: [{ emailAddress: 'private@example.com' }] };
        const get = vi.fn().mockResolvedValue({ data });
        const result = await getFileMetadata.exec({ get } as never, { fileId: 'file-1' });
        expect(result).toEqual({ id: 'file-1', name: 'Report' });
        expect(getFileMetadata.output.parse(data)).toEqual(result);
    });

    it('rejects invalid file IDs and malformed provider responses', async () => {
        expect(() => getFileMetadata.input.parse({ fileId: 'file/other' })).toThrow();
        expect(() => getFileMetadata.input.parse({ fileId: 'file', method: 'DELETE' })).toThrow();
        const get = vi.fn().mockResolvedValue({ data: { name: 'missing id' } });
        await expect(getFileMetadata.exec({ get } as never, { fileId: 'file' })).rejects.toThrow();
        get.mockResolvedValue({ data: { id: 'file', parents: [{ id: 'unexpected nested object', emailAddress: 'private@example.com' }] } });
        await expect(getFileMetadata.exec({ get } as never, { fileId: 'file' })).rejects.toThrow();
    });
});

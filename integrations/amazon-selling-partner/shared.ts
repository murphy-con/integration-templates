import { z } from 'zod';
import type { NangoAction } from 'nango';
import { createCipheriv, createDecipheriv } from 'node:crypto';
// Use standard Web compression streams: Nango's bundler rejects node:zlib.

export const MarketplaceIdSchema = z.string().regex(/^[A-Z0-9]{5,32}$/, 'Invalid Amazon marketplace ID');
export const MarketplaceIdsSchema = z.array(MarketplaceIdSchema).min(1).max(10);
export const PageSizeSchema = z.number().int().min(1).max(100).default(20);
export const TokenSchema = z.string().min(1).max(2048);
export const IsoDateSchema = z.string().datetime({ offset: true });

// Deliberately excludes buyer/recipient/address data. PII access is a separate future capability.
export const OrderIncludedDataSchema = z
    .array(z.enum(['PROCEEDS', 'EXPENSE', 'PROMOTION', 'CANCELLATION', 'FULFILLMENT', 'PACKAGES', 'TAX', 'PAYMENT', 'FULFILLMENT_ORDERS']))
    .max(9)
    .default(['PROCEEDS', 'FULFILLMENT']);

export const ReportTypeSchema = z.enum([
    'GET_FLAT_FILE_OPEN_LISTINGS_DATA',
    'GET_MERCHANT_LISTINGS_ALL_DATA',
    'GET_MERCHANT_LISTINGS_DATA',
    'GET_MERCHANT_LISTINGS_INACTIVE_DATA',
    'GET_MERCHANT_LISTINGS_DATA_LITE',
    'GET_FBA_FULFILLMENT_CURRENT_INVENTORY_DATA',
    'GET_FBA_FULFILLMENT_MONTHLY_INVENTORY_DATA',
    'GET_FBA_FULFILLMENT_INVENTORY_RECEIPTS_DATA',
    'GET_FBA_FULFILLMENT_INVENTORY_SUMMARY_DATA',
    'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL',
    'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_LAST_UPDATE_GENERAL',
    'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE',
    'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE',
    'GET_SALES_AND_TRAFFIC_REPORT',
    'GET_FBA_REIMBURSEMENTS_DATA'
]);

export const ResponseEnvelopeSchema = z.object({}).passthrough();
export const ReportSchema = z
    .object({
        reportId: z.string().optional(),
        reportType: z.string().optional(),
        processingStatus: z.string().optional(),
        marketplaceIds: z.array(z.string()).optional(),
        dataStartTime: z.string().optional(),
        dataEndTime: z.string().optional(),
        reportDocumentId: z.string().optional()
    })
    .passthrough();

export function csv(values: readonly string[]): string {
    return values.join(',');
}

export function sellerIdFromConnection(connection: unknown): string {
    // Nango stores Amazon's redirect_uri_metadata in connection_config.
    const parsed = z.object({ selling_partner_id: z.string().regex(/^[A-Z0-9]{5,64}$/) }).passthrough().safeParse(connection);
    if (!parsed.success) {
        throw new Error('Amazon Seller ID is missing from the server-side connection configuration');
    }
    return parsed.data.selling_partner_id;
}

export async function sellerId(nango: NangoAction): Promise<string> {
    const connection = await nango.getConnection();
    return sellerIdFromConnection(connection?.connection_config);
}

// Nango's Amazon provider stores the seller ID, domain and region in connection_config,
// but has no marketplace allowlist. The Sellers API response is scoped by this
// connection's OAuth token; never substitute a global list of valid marketplace IDs.
const ParticipationSchema = z.object({
    payload: z.array(z.object({
        marketplace: z.object({ id: MarketplaceIdSchema }),
        participation: z.object({ isParticipating: z.boolean() })
    })).max(1000)
});

function requestedMarketplaces(input: unknown): string[] {
    const selection = z.object({
        marketplaceId: MarketplaceIdSchema.optional(),
        marketplaceIds: MarketplaceIdsSchema.optional(),
        requests: z.array(z.object({ marketplaceId: MarketplaceIdSchema })).optional(),
        messages: z.array(z.object({ marketplaceId: MarketplaceIdSchema })).optional()
    }).passthrough().parse(input);
    const envelope = selection.marketplaceIds;
    if (selection.messages?.some(message => !envelope?.includes(message.marketplaceId))) {
        throw new Error('Amazon listing message marketplace is not in the feed envelope');
    }
    return [
        ...(selection.marketplaceId ? [selection.marketplaceId] : []),
        ...(envelope ?? []),
        ...(selection.requests?.map(request => request.marketplaceId) ?? []),
        ...(selection.messages?.map(message => message.marketplaceId) ?? [])
    ];
}

export async function authorizeMarketplaces(nango: NangoAction, input: unknown): Promise<void> {
    const requested = requestedMarketplaces(input);
    if (!requested.length) return;
    await sellerId(nango);
    let participations: z.infer<typeof ParticipationSchema>;
    try {
        participations = ParticipationSchema.parse(await getJson(nango, '/sellers/v1/marketplaceParticipations'));
    } catch {
        throw new Error('Amazon marketplace authorization unavailable for this connection; complete seller enrollment and verify marketplace participations');
    }
    const allowed = new Set(participations.payload
        .filter(entry => entry.participation.isParticipating)
        .map(entry => entry.marketplace.id));
    if (requested.some(id => !allowed.has(id))) {
        throw new Error('Amazon marketplace is not authorized for this seller connection');
    }
}

type RequestParams = Record<string, string | number | undefined>;
const MAX_RESPONSE_BYTES = 250_000;

function boundedResponse<T>(data: T): T {
    const serialized = JSON.stringify(data) ?? 'null';
    if (Buffer.byteLength(serialized, 'utf8') > MAX_RESPONSE_BYTES) {
        throw new Error(`Amazon response exceeds the ${MAX_RESPONSE_BYTES}-byte safety limit`);
    }
    return data;
}

function definedParams(params?: RequestParams): Record<string, string | number> | undefined {
    if (!params) {
        return undefined;
    }
    return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as Record<string, string | number>;
}

export async function getJson<T>(nango: NangoAction, endpoint: string, params?: RequestParams): Promise<T> {
    const response = await nango.get<T>({ endpoint, ...(params ? { params: definedParams(params)! } : {}), retries: 3 });
    return boundedResponse(response.data);
}

export async function postJson<T>(nango: NangoAction, endpoint: string, data: unknown, params?: RequestParams): Promise<T> {
    const response = await nango.post<T>({ endpoint, data, ...(params ? { params: definedParams(params)! } : {}) });
    return boundedResponse(response.data);
}

export async function putJson<T>(nango: NangoAction, endpoint: string, data: unknown, params?: RequestParams): Promise<T> {
    const response = await nango.put<T>({ endpoint, data, ...(params ? { params: definedParams(params)! } : {}) });
    return boundedResponse(response.data);
}

export async function patchJson<T>(nango: NangoAction, endpoint: string, data: unknown, params?: RequestParams): Promise<T> {
    const response = await nango.patch<T>({ endpoint, data, ...(params ? { params: definedParams(params)! } : {}) });
    return boundedResponse(response.data);
}

export type RemoteDocument = {
    url: string;
    compressionAlgorithm: 'GZIP' | undefined;
    encryptionDetails: {
        standard: 'AES';
        initializationVector: string;
        key: string;
    } | undefined;
};

// Report/feed pre-signed document URLs must be S3 HTTPS endpoints. Never follow
// redirects: they could take a valid signed URL to an internal network target.
function approvedDocumentUrl(raw: string): URL {
    const url = new URL(raw);
    const s3Host = /^(?:[a-z0-9][a-z0-9.-]*\.)?s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com(?:\.cn)?$/.test(url.hostname);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !s3Host) {
        throw new Error('Amazon document URL is not an approved HTTPS S3 host');
    }
    return url;
}

async function boundedBytes(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) throw new Error(`Amazon document exceeds the ${maxBytes}-byte safety limit`);
            chunks.push(value);
        }
    } finally {
        await reader.cancel().catch(() => undefined);
    }
    return Buffer.concat(chunks, size);
}

async function gzipTransform(payload: Buffer, mode: 'compress' | 'decompress', maxBytes: number): Promise<Buffer> {
    const stream = new Blob([new Uint8Array(payload)]).stream();
    const transformed = mode === 'compress'
        ? stream.pipeThrough(new CompressionStream('gzip'))
        : stream.pipeThrough(new DecompressionStream('gzip'));
    return boundedBytes(transformed, maxBytes);
}

export async function downloadDocument(document: RemoteDocument, maxBytes = 100_000): Promise<string> {
    const url = approvedDocumentUrl(document.url);
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
        throw new Error(`Amazon document download failed with HTTP ${response.status}`);
    }
    if (!response.body) throw new Error('Amazon document response has no body');
    let payload = await boundedBytes(response.body, maxBytes * 10 + 65536);
    if (document.encryptionDetails) {
        const details = document.encryptionDetails;
        const decipher = createDecipheriv('aes-256-cbc' as never, Buffer.from(details.key, 'base64') as never, Buffer.from(details.initializationVector, 'base64') as never) as any;
        payload = Buffer.concat([decipher.update(payload), decipher.final()]) as any;
    }
    if (document.compressionAlgorithm === 'GZIP') {
        payload = await gzipTransform(payload, 'decompress', maxBytes);
    }
    if (payload.byteLength > maxBytes) {
        throw new Error(`Amazon document exceeds the ${maxBytes}-byte safety limit`);
    }
    return payload.toString('utf8');
}

export async function uploadDocument(document: RemoteDocument, content: string, contentType: string): Promise<void> {
    const url = approvedDocumentUrl(document.url);
    let payload: Buffer = Buffer.from(content, 'utf8');
    if (payload.byteLength > 5_000_000) throw new Error('Amazon feed document exceeds the 5000000-byte safety limit');
    if (document.compressionAlgorithm === 'GZIP') {
        payload = await gzipTransform(payload, 'compress', 5_000_000);
    }
    if (document.encryptionDetails) {
        const details = document.encryptionDetails;
        const cipher = createCipheriv('aes-256-cbc' as never, Buffer.from(details.key, 'base64') as never, Buffer.from(details.initializationVector, 'base64') as never) as any;
        payload = Buffer.concat([cipher.update(payload), cipher.final()]) as any;
    }
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: payload as never,
        redirect: 'error',
        signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) {
        throw new Error(`Amazon feed document upload failed with HTTP ${response.status}`);
    }
}

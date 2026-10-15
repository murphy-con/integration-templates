import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type SnapshotAction = {
    action: string;
    path: string;
    source_sha256: string;
};

type SnapshotProfile = {
    provider_config_key: string;
    action_count: number;
    actions: SnapshotAction[];
};

type SnapshotManifest = {
    profiles: SnapshotProfile[];
    profile_action_counts: Record<string, number>;
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(repositoryRoot, 'integrations/nango-dev-action-snapshot.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as SnapshotManifest;

describe('Nango Dev action snapshot', () => {
    it('preserves every captured source file and action count exactly', () => {
        const profileKeys = manifest.profiles.map((profile) => profile.provider_config_key);
        expect(new Set(profileKeys).size).toBe(profileKeys.length);

        let totalActions = 0;
        for (const profile of manifest.profiles) {
            const names = profile.actions.map((action) => action.action);
            expect(profile.action_count).toBe(profile.actions.length);
            expect(manifest.profile_action_counts[profile.provider_config_key]).toBe(profile.actions.length);
            expect(new Set(names).size).toBe(names.length);
            totalActions += profile.actions.length;

            for (const action of profile.actions) {
                expect(action.path.startsWith('integrations/')).toBe(true);
                expect(action.path.split('/')).not.toContain('..');
                const source = readFileSync(resolve(repositoryRoot, action.path));
                const sha256 = createHash('sha256').update(source).digest('hex');
                expect(sha256, action.path).toBe(action.source_sha256);
            }
        }

        expect(totalActions).toBe(51);
    });
});
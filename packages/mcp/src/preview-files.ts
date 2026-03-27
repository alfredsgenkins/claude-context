#!/usr/bin/env node
/**
 * CLI tool to preview which files would be indexed for a given codebase path.
 * Reuses the same ignore pattern loading and file-walking logic as the indexer.
 *
 * Usage:
 *   node dist/preview-files.js <path> [--ext .vue,.phtml] [--ignore 'vendor/**']
 */

import * as path from 'path';
import { Context, VectorDatabase } from '@zilliz/claude-context-core';

// Minimal no-op VectorDatabase stub — preview doesn't need actual DB access
const stubVectorDatabase: VectorDatabase = {
    createCollection: async () => {},
    createHybridCollection: async () => {},
    dropCollection: async () => {},
    hasCollection: async () => false,
    listCollections: async () => [],
    insert: async () => {},
    insertHybrid: async () => {},
    search: async () => [],
    hybridSearch: async () => [],
    delete: async () => {},
    query: async () => [],
    getCollectionDescription: async () => '',
    checkCollectionLimit: async () => true,
};

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log('Usage: preview-files <path> [--ext .vue,.phtml] [--ignore "vendor/**,tmp/**"]');
        console.log('');
        console.log('Options:');
        console.log('  --ext      Comma-separated extra extensions to include (e.g. .vue,.phtml)');
        console.log('  --ignore   Comma-separated extra ignore patterns (e.g. vendor/**,tmp/**)');
        process.exit(0);
    }

    const codebasePath = path.resolve(args[0]);

    const extIndex = args.indexOf('--ext');
    const customExtensions = extIndex !== -1 && args[extIndex + 1]
        ? args[extIndex + 1].split(',').map(e => e.trim())
        : [];

    const ignoreIndex = args.indexOf('--ignore');
    const customIgnorePatterns = ignoreIndex !== -1 && args[ignoreIndex + 1]
        ? args[ignoreIndex + 1].split(',').map(p => p.trim())
        : [];

    const context = new Context({
        vectorDatabase: stubVectorDatabase,
        ...(customExtensions.length > 0 && { customExtensions }),
        ...(customIgnorePatterns.length > 0 && { customIgnorePatterns }),
    });

    // Load .gitignore and other ignore files — same as the indexer does
    await context.getLoadedIgnorePatterns(codebasePath);

    const files = await context.getCodeFiles(codebasePath);

    // Group by extension for summary
    const byExt = new Map<string, number>();
    for (const f of files) {
        const ext = path.extname(f) || '(no ext)';
        byExt.set(ext, (byExt.get(ext) ?? 0) + 1);
    }

    const sorted = [...byExt.entries()].sort((a, b) => b[1] - a[1]);

    console.log(`\nFiles that would be indexed: ${files.length}\n`);
    console.log('By extension:');
    for (const [ext, count] of sorted) {
        console.log(`  ${ext.padEnd(12)} ${count}`);
    }
    console.log('');
    console.log('File list:');
    for (const f of files) {
        console.log(`  ${path.relative(codebasePath, f)}`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

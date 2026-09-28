// The editing helpers now live in src/lib/text-blocks.ts so the public project pages and the
// build-time prerender can use them too. Re-exported here for the admin screens.
export { blocksToText, slugify, textToBlocks, wordCount } from '@/lib/text-blocks';

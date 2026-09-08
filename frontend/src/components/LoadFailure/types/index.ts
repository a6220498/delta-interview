/**
 * The public type surface of `LoadFailure`.
 *
 * Callers import from here rather than from the declaration file, so how the
 * types are split up inside this folder stays the folder's own business.
 *
 * Re-exported with `export type` rather than plain `export`: the source is a
 * `.d.ts` file with no runtime counterpart, so a value re-export would compile
 * to an `import './load-failure'` that the bundler could not resolve.
 */
export type { LoadFailureEmits, LoadFailureProps } from './load-failure'

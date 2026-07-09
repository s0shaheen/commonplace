// Hand-written types for the build-time precompiled standalone validators
// (`validators.js`, emitted by scripts/build-validators.mjs — gitignored, regenerated on build).
// This declaration is committed (see the `!validators.d.ts` un-ignore in .gitignore) so `tsc`
// resolves `./generated/validators.js` without needing a prior build. Ajv standalone validators
// are plain predicates that also carry a mutable `.errors` array populated on the last failure.

export interface StandaloneValidator {
  (data: unknown): boolean;
  errors?: unknown[] | null;
}

export const validateItem: StandaloneValidator;
export const validateExtractorOutput: StandaloneValidator;

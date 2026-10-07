import { planReviewSchema } from "./planReview.ts";
import { planTranscriptSchema } from "./planTranscript.ts";
import { revisionCheckSchema } from "./revisionCheck.ts";
import { textReviewSchema } from "./textReview.ts";
import { textTranscriptSchema } from "./textTranscript.ts";

/**
 * Model output schemas by name. The name is the file stem under schemas/ and the
 * `output_schema` value in the prompt frontmatter (spec 7.3).
 */
export const OUTPUT_SCHEMAS = {
  planTranscript: planTranscriptSchema,
  planReview: planReviewSchema,
  textTranscript: textTranscriptSchema,
  textReview: textReviewSchema,
  revisionCheck: revisionCheckSchema,
} as const;

export type OutputSchemaName = keyof typeof OUTPUT_SCHEMAS;
export const OUTPUT_SCHEMA_NAMES = Object.keys(OUTPUT_SCHEMAS) as [OutputSchemaName, ...OutputSchemaName[]];

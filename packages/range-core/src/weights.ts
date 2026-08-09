/**
 * The two numbers the range design turns on, named once.
 *
 * `reading` is charged to every `date` and `time` claim so a bare "3pm" still
 * reads as a datetime. `signature` is paid back by each range op signature, and
 * must exceed twice `|reading|` or the two penalties cancel and the contest
 * ties. It stays under CONTEXT_BONUS (30) so it cannot overturn a corrected
 * reading.
 *
 * They live in `range-core` rather than in each range package because the
 * relationship between them — one payback against two penalties — is the whole
 * argument, and three copies of a number whose value is only meaningful
 * relative to another number is how that argument gets quietly broken.
 */
export const RANGE_WEIGHTS = { reading: -5, signature: 20 } as const;

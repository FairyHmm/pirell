// Relational shape vocabulary
export type Scalar = [];
export type Column = ["i", "..."];
export type Row = ["k", "..."];
export type Table = ["i", "k", "..."];
/**
 * Database: keyed record of tables with differing row shapes (the
 * common fact-plus-dimensions case), proving `["k..."]`. Uniform dbs
 * (same-shaped tables) prove a uniform stack instead and are rejected
 * — join those tables with standalone {@linkcode join}.
 */
export type Db = ["k..."];

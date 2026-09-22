/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as events from "../events.js";
import type * as lib_firecrawlEvidence from "../lib/firecrawlEvidence.js";
import type * as lib_researchWorkflow from "../lib/researchWorkflow.js";
import type * as outreach from "../outreach.js";
import type * as outreachData from "../outreachData.js";
import type * as research from "../research.js";
import type * as researchData from "../researchData.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  events: typeof events;
  "lib/firecrawlEvidence": typeof lib_firecrawlEvidence;
  "lib/researchWorkflow": typeof lib_researchWorkflow;
  outreach: typeof outreach;
  outreachData: typeof outreachData;
  research: typeof research;
  researchData: typeof researchData;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
};

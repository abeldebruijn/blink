/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as feedImports from "../feedImports.js";
import type * as feedSubscriptions from "../feedSubscriptions.js";
import type * as homeFeed from "../homeFeed.js";
import type * as importWorkflow from "../importWorkflow.js";
import type * as migrations from "../migrations.js";
import type * as myFunctions from "../myFunctions.js";
import type * as readers from "../readers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  feedImports: typeof feedImports;
  feedSubscriptions: typeof feedSubscriptions;
  homeFeed: typeof homeFeed;
  importWorkflow: typeof importWorkflow;
  migrations: typeof migrations;
  myFunctions: typeof myFunctions;
  readers: typeof readers;
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
  homeFeedBuckets: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"homeFeedBuckets">;
};

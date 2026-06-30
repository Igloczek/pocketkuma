/* eslint-disable camelcase */
/*!
// Common Util for frontend and backend
//
// Backend and frontend both load this TypeScript source directly under Bun/Vite.
// This module re-exports shared and backend utilities for backward compatibility.
// Frontend code should import from @/constants and @/util-shared instead.
*/

export * from "@/constants";
export * from "@/util-shared";
export * from "@/util-backend";

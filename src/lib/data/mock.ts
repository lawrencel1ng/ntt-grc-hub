// Barrel re-export for all mock data. The server dispatcher
// (`$lib/server/data`) imports * as mock from here, so adding a new
// domain just means exporting it from this file.

export * from './tenants';
export * from './agents';
export * from './frameworks';
export * from './risks';
export * from './controls';
export * from './evidence';
export * from './audits';
export * from './policies';
export * from './vendors';
export * from './specialized';
export * from './regwatch';
export * from './incidents';
export * from './workflows';

export type * from './types';

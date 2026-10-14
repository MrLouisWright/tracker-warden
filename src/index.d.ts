import type { Report, Rule } from './core.js';
export * from './core.js';
export interface Vendor { id: string; name: string; company: string; category: string; domains: string[]; globals: string[]; sells: boolean; cookieless?: boolean; essential?: boolean; kb: number; policyNames: string[] }
export interface InventoryEntry { id: string; name: string; company: string | null; category: string; sells: boolean; cookieless: boolean; unknown: boolean; pages: string[]; urls: string[]; kinds: string[] }
export interface TrackerOptions { baseUrl?: string; include?: string[]; exclude?: string[]; cleanUrls?: boolean; approved?: string[]; inventoryFile?: string; now?: Date; toolVersion?: string; [option: string]: unknown }
export declare const RULES: Record<string, Rule>;
export declare const VENDORS: Vendor[];
export declare const SITE_OPTIONS: Record<string, { type: 'string' | 'boolean'; multiple?: boolean }>;
export declare const SITE_HELP: string;
export declare function vendorForUrl(url: string): Vendor | null;
export declare function inventory(site: unknown, config?: Record<string, unknown>): InventoryEntry[];
export declare function toCsv(inventory: InventoryEntry[]): string;
export declare function check(dir: string, opts?: TrackerOptions, config?: Record<string, unknown>, configFile?: string): Report;
export declare function analyze(site: unknown, opts?: TrackerOptions, config?: Record<string, unknown>): { findings: Report['findings']; info: Record<string, unknown>; summary: string };

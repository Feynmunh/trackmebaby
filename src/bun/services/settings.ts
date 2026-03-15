/**
 * Settings Service — typed getter/setter over SQLite settings table
 * Provides default values and round-trip persistence
 */
import type { Database } from "bun:sqlite";
import { normalizeAIModel } from "../../shared/ai-models.ts";
import {
    resolveAIProvider,
    type SupportedAIProvider,
} from "../../shared/ai-provider.ts";
import type { Settings } from "../../shared/types.ts";
import { getSetting, setSetting } from "../db/queries.ts";

// Default settings values
const DEFAULTS: Settings = {
    basePath: null,
    aiProvider: "groq",
    aiModel: "llama-3.3-70b-versatile",
    pollInterval: 60000,
    watchDebounce: 500,
};

export class SettingsService {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    // --- Typed getters ---

    getBasePath(): string | null {
        return getSetting(this.db, "basePath") ?? DEFAULTS.basePath;
    }

    getAIProvider(): SupportedAIProvider {
        const rawProvider = getSetting(this.db, "aiProvider");
        if (!rawProvider) {
            return DEFAULTS.aiProvider;
        }
        return resolveAIProvider(rawProvider);
    }

    getAIModel(): string {
        const provider = this.getAIProvider();
        return normalizeAIModel(provider, getSetting(this.db, "aiModel"));
    }

    getPollInterval(): number {
        const val = getSetting(this.db, "pollInterval");
        return val ? parseInt(val, 10) : DEFAULTS.pollInterval;
    }

    getWatchDebounce(): number {
        const val = getSetting(this.db, "watchDebounce");
        return val ? parseInt(val, 10) : DEFAULTS.watchDebounce;
    }

    // --- Typed setters ---

    setBasePath(path: string): void {
        setSetting(this.db, "basePath", path);
    }

    setAIProvider(provider: string): void {
        setSetting(this.db, "aiProvider", resolveAIProvider(provider));
    }

    setAIModel(model: string): void {
        const provider = this.getAIProvider();
        setSetting(this.db, "aiModel", normalizeAIModel(provider, model));
    }

    setPollInterval(ms: number): void {
        setSetting(this.db, "pollInterval", String(Math.max(30000, ms)));
    }

    setWatchDebounce(ms: number): void {
        setSetting(this.db, "watchDebounce", String(Math.max(100, ms)));
    }

    // --- Bulk operations ---

    getAll(): Settings {
        return {
            basePath: this.getBasePath(),
            aiProvider: this.getAIProvider(),
            aiModel: this.getAIModel(),
            pollInterval: this.getPollInterval(),
            watchDebounce: this.getWatchDebounce(),
        };
    }

    updateMany(settings: Partial<Settings>): void {
        if (settings.basePath !== undefined)
            this.setBasePath(settings.basePath!);
        if (settings.aiProvider !== undefined)
            this.setAIProvider(settings.aiProvider);
        if (settings.aiModel !== undefined) this.setAIModel(settings.aiModel);
        if (settings.pollInterval !== undefined)
            this.setPollInterval(settings.pollInterval);
        if (settings.watchDebounce !== undefined)
            this.setWatchDebounce(settings.watchDebounce);
    }
}

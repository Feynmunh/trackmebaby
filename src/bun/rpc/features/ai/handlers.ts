import type { Database } from "bun:sqlite";
import { toErrorData, toErrorMessage } from "../../../../shared/error.ts";
import { createLogger } from "../../../../shared/logger.ts";
import { assembleContext } from "../../../services/ai/context-assembler.ts";
import { type AIProvider } from "../../../services/ai/index.ts";

export interface AIHandlersDeps {
    db: Database;
    getAIProvider: () => AIProvider;
}

const logger = createLogger("rpc");

export function createAIHandlers({ db, getAIProvider }: AIHandlersDeps) {
    return {
        queryAI: async ({ question }: { question: string }) => {
            try {
                const context = assembleContext(db, question);
                const provider = getAIProvider();
                return await provider.query(context, question);
            } catch (err: unknown) {
                const message = toErrorMessage(err);
                logger.error("ai query error", {
                    error: toErrorData(err),
                });
                return `Error: ${message}`;
            }
        },
    };
}

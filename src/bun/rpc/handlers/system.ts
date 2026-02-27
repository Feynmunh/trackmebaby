import { emitLog } from "../../../shared/logger.ts";

export function createSystemHandlers() {
    return {
        log: ({
            entry,
        }: {
            entry: import("../../../shared/logger.ts").LogEntry;
        }) => {
            emitLog(entry);
        },
    };
}

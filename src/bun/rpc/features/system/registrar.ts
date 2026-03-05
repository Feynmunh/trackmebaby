import {
    createSystemMessageHandlers,
    createSystemRequestHandlers,
} from "./handlers.ts";

export function registerSystemMessageHandlers() {
    return createSystemMessageHandlers();
}

export function registerSystemRequestHandlers() {
    return createSystemRequestHandlers();
}

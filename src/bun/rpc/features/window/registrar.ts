import { BrowserWindow } from "electrobun/bun";
import { createWindowHandlers } from "./handlers.ts";

type BrowserWindowInstance = InstanceType<typeof BrowserWindow>;

export interface WindowRegistrarDeps {
    getMainWindow: () => BrowserWindowInstance | null;
}

export function registerWindowHandlers({ getMainWindow }: WindowRegistrarDeps) {
    return createWindowHandlers({ getMainWindow });
}

/// <reference types="node" />
declare module "electrobun/bun" {
    export type RPCSchema<TSchema> = TSchema;

    export type RPCHandlers<TSchema> = TSchema extends {
        bun: { requests: infer R };
    }
        ? {
              [K in keyof R]: (
                  params: R[K] extends { params: infer P } ? P : never,
              ) =>
                  | Promise<R[K] extends { response: infer Res } ? Res : never>
                  | (R[K] extends { response: infer Res } ? Res : never);
          }
        : Record<string, never>;

    /** Outgoing push-message senders: one method per webview message */
    export type RPCMessageSenders<TSchema> = TSchema extends {
        webview: { messages: infer M };
    }
        ? { [K in keyof M]: (payload: M[K]) => void }
        : Record<string, never>;

    export interface BrowserViewRPC<TSchema> {
        maxRequestTime?: number;
        handlers: {
            requests: RPCHandlers<TSchema>;
            messages: TSchema extends { bun: { messages: infer M } }
                ? { [K in keyof M]: (params: M[K]) => void }
                : Record<string, never>;
        };
        /** Send push messages to the webview */
        send: RPCMessageSenders<TSchema>;
    }

    export interface BrowserViewStatic {
        defineRPC<TSchema>(
            schema: Omit<BrowserViewRPC<TSchema>, "send">,
        ): BrowserViewRPC<TSchema>;
    }

    export const BrowserView: BrowserViewStatic;

    export interface BrowserWindowInstance {
        focus(): void;
        minimize(): void;
        maximize(): void;
        unmaximize(): void;
        isMaximized(): boolean;
        close(): void;
        getPosition(): { x: number; y: number };
        setPosition(x: number, y: number): void;
        setIcon(iconPath: string): void;
        on(event: string, callback: () => void): void;
    }

    export const BrowserWindow: new (options: {
        title: string;
        url: string;
        rpc: unknown;
        titleBarStyle: string;
        transparent: boolean;
        styleMask: {
            Titled: boolean;
            Closable: boolean;
            Resizable: boolean;
            Miniaturizable: boolean;
        };
        frame: { width: number; height: number; x: number; y: number };
    }) => BrowserWindowInstance;

    export interface TrayMenuItem {
        type: "normal" | "divider";
        label?: string;
        action?: string;
    }

    export interface TrayInstance {
        setMenu(menu: TrayMenuItem[]): void;
        setImage(imagePath: string): void;
        on(event: string, callback: (event: unknown) => void): void;
    }

    export const Tray: new (options: {
        title: string;
        width: number;
        height: number;
        image?: string;
        template?: boolean;
    }) => TrayInstance;

    export interface UtilsPaths {
        userData?: string;
    }

    export interface Utils {
        paths: UtilsPaths;
        quit(): void;
    }

    export const Utils: Utils;

    export interface Updater {
        localInfo: {
            channel(): Promise<string>;
        };
    }

    export const Updater: Updater;

    export interface ElectrobunEvents {
        on(event: "before-quit", callback: () => void): void;
    }

    export interface ElectrobunStatic {
        events: ElectrobunEvents;
    }

    const Electrobun: ElectrobunStatic;
    export default Electrobun;
}

declare module "electrobun" {
    export interface ElectrobunConfig {
        app: {
            name: string;
            identifier: string;
            version: string;
        };
        runtime: {
            exitOnLastWindowClosed: boolean;
        };
        build: {
            copy?: Record<string, string>;
        };
    }
}

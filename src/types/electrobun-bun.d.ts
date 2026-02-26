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

    export interface BrowserViewRPC<TSchema> {
        handlers: {
            requests: RPCHandlers<TSchema>;
            messages: TSchema extends { bun: { messages: infer M } }
                ? { [K in keyof M]: (params: M[K]) => void }
                : Record<string, never>;
        };
    }

    export interface BrowserViewStatic {
        defineRPC<TSchema>(
            schema: BrowserViewRPC<TSchema>,
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
        on(event: string, callback: (event: unknown) => void): void;
    }

    export const Tray: new (options: {
        title: string;
        width: number;
        height: number;
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

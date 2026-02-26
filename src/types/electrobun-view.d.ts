declare module "electrobun/view" {
    export type RPCSchema<TSchema> = TSchema;

    export type MessageHandlers<TSchema> = TSchema extends {
        webview: { messages: infer M };
    }
        ? { [K in keyof M]: (params: M[K]) => void }
        : Record<string, never>;

    export interface ElectroviewRPC<TSchema> {
        handlers: {
            requests: Record<string, never>;
            messages: MessageHandlers<TSchema>;
        };
        send?: TSchema extends { bun: { messages: infer M } }
            ? { [K in keyof M]: (params: M[K]) => void }
            : Record<string, never>;
    }

    export type RPCRequest<TSchema> = TSchema extends {
        bun: { requests: infer R };
    }
        ? {
              [K in keyof R]: (
                  params: R[K] extends { params: infer P } ? P : never,
              ) => Promise<R[K] extends { response: infer Res } ? Res : never>;
          }
        : Record<string, never>;

    export interface ElectroviewRPCClient<TSchema> {
        request: RPCRequest<TSchema>;
    }

    export class Electroview<TSchema = unknown> {
        constructor(args: { rpc: ElectroviewRPC<TSchema> });
        rpc?: ElectroviewRPCClient<TSchema>;

        static defineRPC<TSchema>(
            schema: ElectroviewRPC<TSchema>,
        ): ElectroviewRPC<TSchema>;
    }
}

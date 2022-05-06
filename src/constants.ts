import {StateTree, Store} from "pinia";

export const IMMUTABLE_STATE_PROXY_UNWRAP_KEY = Symbol();

export const IMMUTABLE_STATE_PROXY_HANDLER = {
    get <T extends Record<string | symbol | number, any>> (target: T, key: string | symbol | number): T {
        if (key === IMMUTABLE_STATE_PROXY_UNWRAP_KEY) {
            return target;
        }

        if (typeof target[key] === "object" && target[key] !== null) {
            return new Proxy(target[key], IMMUTABLE_STATE_PROXY_HANDLER);
        }

        return target[key];

    },
    set () {
        throw new ReferenceError("Mutations in getters are not allowed.");
    },
} as const;

export const OBJECT_TYPES_TYPEOF_VALUES = ["object", "function"];

export const NOOP_FUNC = (): undefined => undefined;

export const MOCK_STATE: StateTree = {};

export const MOCK_STORE: Store<any, StateTree> = {
    $state: MOCK_STATE,
    $patch: NOOP_FUNC,
    $onAction: () => NOOP_FUNC,
    $reset: NOOP_FUNC,
    $subscribe: () => NOOP_FUNC,
    $dispose: NOOP_FUNC,
    $id: Symbol(),
    _customProperties: new Set<string>(),
    $options: {},
    defineAction: () => NOOP_FUNC,
    defineGetter: () => NOOP_FUNC,
};

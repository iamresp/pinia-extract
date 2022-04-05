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

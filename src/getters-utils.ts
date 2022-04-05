import {
    computed,
    ComputedRef,
    isRef,
    Ref,
    WritableComputedRef,
} from "vue";

import {
    IMMUTABLE_STATE_PROXY_HANDLER,
    IMMUTABLE_STATE_PROXY_UNWRAP_KEY,
    OBJECT_TYPES_TYPEOF_VALUES,
} from "./constants";
import {
    TAction,
    TGetterRegistry,
    TImmutable,
    TExternalGetter,
    TGetterFactoryRegistry,
} from "./types";

/**
 * Creates getter factory registry that differentiates call instances of the same factory basing on each call
 * arguments to avoid side effects.
 *
 * @returns Registry of all getter factories registered in application.
 */
function createGetGetterFactoryRegistry () {
    let registry: any;

    return <S extends object, T>(): TGetterFactoryRegistry<S, T> => {
        if (!registry) {
            registry = new Map();
        }

        return registry as TGetterFactoryRegistry<S, T>;
    };
}

const getGetterFactoryRegistry = createGetGetterFactoryRegistry();

/**
 * Creates registry for caching computed wrappers of getters. Helps to avoid creating new computed wrappers each time
 * when `useGetter` called - since wrappers created by these functions do not keep data or change behaviour between
 * calls, it is safe to wrap getter with `computed` just once for each getter / factory and reuse it.
 *
 * @returns Getters registry with getters or getter factory arguments as keys and getters as values.
 */
function createGetGetterRegistry () {
    let registry: any;

    return <S extends object, T>(): TGetterRegistry<S, T> => {
        if (!registry) {
            registry = new Map();
        }

        return registry as TGetterRegistry<S, T>;
    };
}

const getGetterRegistry = createGetGetterRegistry();

/**
 * Wraps object with recursively immutable proxy.
 *
 * @returns {S} Recursively immutable state that implements TImmutable type.
 */
const getImmutableState = <S extends object>(state: S): S => (
    new Proxy<S>(state, IMMUTABLE_STATE_PROXY_HANDLER)
);

/**
 * In `useGetter` and `useGetterFactory` checks is the value immutable.
 * By design every object returned by external getter in these composition function is immutable.
 * NOTE: considering the statement above, you can not rely on this check outside of these functions.
 * For more reliable checks it is necessary to determine is an IMMUTABLE_STATE_PROXY_UNWRAP_KEY property exists
 * on value.
 *
 * @param {T} value Getter result.
 * @returns {boolean} Is value of any object type - and, due to this, retrieved as immutable.
 */
const checkImmutability = <T>(value: T): value is TImmutable<T> => (
    typeof value === "object" && value !== null
);

/**
 * Checks whether a specified variable is a ref of primitive value.
 *
 * @param {T} variable Variable to check.
 * @returns {boolean} Is variable a ref of primitive value.
 */
const isRefOfPrimitive = <T>(variable: T | Ref<T>): variable is Ref<T> => (
    isRef(variable) && OBJECT_TYPES_TYPEOF_VALUES.includes(typeof variable.value)
);

/**
 * Composition function for applying external getter in Vue component.
 *
 * @param {TExternalGetter<S, T>} getter Getter to apply.
 *
 * @returns {ComputedRef<T>}
 */
export function useGetter<S extends object, T> (getter: TExternalGetter<S, T>): ComputedRef<T>;

/**
 * Composition function for applying external getter in Vue component.
 *
 * @param {TExternalGetter<S, T>} getter Getter to apply.
 * @param {TAction<S>} action Action to be used as setter (value will be passed as first argument).
 * @param {P} [additionalPayload] Other arguments (second and further) to be passed on setter call.
 *
 * @returns {WritableComputedRef<T>}
 */
export function useGetter <S extends object, T, P extends unknown[]> (
    getter: TExternalGetter<S, T>,
    action: TAction<S>,
    ...additionalPayload: P
): WritableComputedRef<T>;

export function useGetter <S extends object, T, P extends unknown[]> (
    getter: TExternalGetter<S, T>,
    action?: TAction<S>,
    ...additionalPayload: P
): ComputedRef<T> | WritableComputedRef<T> {
    let previousValue: T;

    const getterRegistry = getGetterRegistry<S, T>();

    if (!getterRegistry.get(getter)) {
        getterRegistry.set(getter, () => {
            const state = getImmutableState(getter.store.$state);
            const getterResult = getter(state);

            return checkImmutability(getterResult)
                ? getterResult?.[IMMUTABLE_STATE_PROXY_UNWRAP_KEY]
                : getterResult;
        });
    }

    const get = getterRegistry.get(getter);

    if (action) {
        const set = (value: T) => {
            if (value === previousValue) return;
            const payload: Array<T | P[number]> = additionalPayload.slice(0);

            previousValue = value;
            payload.unshift(value);

            action.apply(getter.store, payload);
        };

        return computed({get, set});

    }

    return computed(get);

}

/**
 * Composition function for applying external getter factory in Vue component.
 * Accepts higher order function that returns external getter. Returns external getter call result.
 *
 * @param getterFactory Function that returns getter.
 * @param {A} [args] Factory arguments to be applied.
 */
export function useGetterFactory<S extends object, T, A extends unknown[]> (
    getterFactory: (...args: A) => TExternalGetter<S, T>,
    ...args: Array<A[number] | Ref<A[number]>>
): ComputedRef<T> {
    const factoryRegistry = getGetterFactoryRegistry<S, T>();
    let shouldAlwaysRecompute = false;

    if (args.some(arg => arg !== null && OBJECT_TYPES_TYPEOF_VALUES.includes(typeof arg) && !isRefOfPrimitive(arg))) {
        shouldAlwaysRecompute = true;
    }

    const key = shouldAlwaysRecompute ? undefined : args.map(arg => isRef(arg) ? arg.value : arg).toString();

    if (!factoryRegistry.get(getterFactory)) {
        factoryRegistry.set(getterFactory, new Map());
    }

    const getterRegistry = factoryRegistry.get(getterFactory);

    if (shouldAlwaysRecompute || !getterRegistry.get(key)) {
        const get = () => {
            const argsValues = [] as A;

            // loop instead of .map for performance
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];

                argsValues[i] = isRef(arg) ? arg.value : arg;
            }

            const getter = getterFactory.apply(null, argsValues);
            const state = getImmutableState(getter.store.$state);
            const getterResult = getter(state);

            return checkImmutability(getterResult)
                ? getterResult?.[IMMUTABLE_STATE_PROXY_UNWRAP_KEY]
                : getterResult;
        };

        // if memoization can not be provided, registry is not used
        if (shouldAlwaysRecompute) return computed(get);

        getterRegistry.set(key, get);
    }

    return computed(getterRegistry.get(key));
}

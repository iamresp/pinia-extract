import {
    createPinia,
    getActivePinia,
    setActivePinia,
    StateTree,
    StoreDefinition,
} from "pinia";
import {createApp} from "vue";

import {MOCK_STORE, NOOP_FUNC} from "./constants";
import {PiniaExtractPlugin} from "./plugin";
import {
    IPiniaExtractProperties,
    TActionCombiner,
    TCreateGetterArgs,
    TExternalAction,
    TExternalGetter,
    TExtractState,
    TGetterCombiner,
    TStore,
} from "./types";

declare module "pinia" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface PiniaCustomProperties extends IPiniaExtractProperties {}
}

/**
 * Used instead of normal store for pending postponed getters.
 * Simulates normal store behaviour, but does nothing and keeps no data.
 * @returns Typed mocked store.
 */
const getMockStore = <S, T>() => MOCK_STORE as TStore<S, T>;

/**
 * @deprecated
 * Consider using `postponed` instead.
 *
 * Connects Pinia Extract and immediately activates it before the Vue app is initiated and mounted.
 * Can wrap existing Pinia instance or create a new one.
 *
 * @param {Pinia} [pinia] - Pinia instance. Can be omitted.
 * @returns {Pinia} Pinia instance with PiniaExtractPlugin installed and activated.
 */

export function withExtract (pinia = createPinia()) {
    pinia.use(PiniaExtractPlugin);
    // if app does not exist, Pinia will add all plugins to waitlist instead of activating them
    const hollowApp = createApp({});

    hollowApp.use(pinia); // makes Pinia activate Extract
    setActivePinia(pinia);

    return pinia;
}

/**
 * Creates store wrapper that exposes postponed definition functions of external actions and getters.
 * Definitions made by these are safely delayed until store is ready to use.
 * Both postponed `defineAction` and `defineGetter` behave the very same way as those in stores, the only difference
 * is that they are safe to use until Pinia and Pinia Extract are ready to use.
 *
 * @param {StoreDefinition} useStore - Store composable definition.
 * @returns Store wrapper that exposes postponed `defineAction` and `defineGetter`.
 */
export function postponed <S extends StateTree, D extends StoreDefinition<string, S>> (useStore: D) {
    return {
        defineAction<P extends ReturnType<D>, A extends any[], T> (
            this: P,
            action: TActionCombiner<P, A, T>,
        ): TExternalAction<P, A, T> {
            let impl = NOOP_FUNC as TExternalAction<P, A, T>;
            let isDefined = false;

            return ((...args: A) => {
                const pinia = getActivePinia();

                if (pinia && !isDefined) {
                    const store = useStore(pinia);

                    impl = store.defineAction(action);
                    isDefined = true;

                    return impl.apply(this, args);
                }

                return impl.apply(MOCK_STORE, args);
            }) as TExternalAction<P, A, T>;

        },
        defineGetter: <I extends TExternalGetter<S>[], C extends TGetterCombiner<S, I>> (
            ...args: TCreateGetterArgs<S, I, C>
        ): TExternalGetter<TExtractState<S, I, C>, ReturnType<C> | undefined> => {
            let impl: TExternalGetter<TExtractState<S, I, C>, ReturnType<C> | undefined> = NOOP_FUNC;
            let isDefined = false;

            const wrappedGetter = ((state: TExtractState<S, I, C>) => {
                const pinia = getActivePinia();

                if (pinia && !isDefined) {
                    const store = useStore(pinia) as TStore<TExtractState<S, I, C>, ReturnType<C> | undefined>;

                    impl = store.defineGetter(...args);
                    isDefined = true;
                }

                return impl.apply(null, [state]);
            }) as TExternalGetter<TExtractState<S, I, C>, ReturnType<C> | undefined>;

            Object.defineProperty(wrappedGetter, "store", {
                get () {
                    const pinia = getActivePinia();

                    return pinia
                        ? useStore(pinia)
                        : getMockStore<TExtractState<S, I, C>, ReturnType<C> | undefined>();
                },
            });

            return wrappedGetter;
        },
    } as ReturnType<D>;
}

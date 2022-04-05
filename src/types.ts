import {PiniaCustomStateProperties, StateTree, Store} from "pinia";
import {ComputedGetter, UnwrapRef} from "vue";

import {IMMUTABLE_STATE_PROXY_UNWRAP_KEY} from "./constants";

type TCustomProperties<S, T> = {
    defineAction<P extends Store, A extends any[]>(
        this: P,
        combiner: TActionCombiner<P, A, T>,
    ): TExternalAction<P, A, T>;
    defineGetter: (...args: TCreateGetterArgs<S, any, T>) => TExternalGetter<S, T>;
};

export type TStore<S, T> = Store<any, S> & TCustomProperties<S, T>;

export type TGetterRegistry<S extends object, T> = Map<TExternalGetter<S, T> | string, ComputedGetter<T>>;

export type TGetterFactoryRegistry<S extends object, T> = Map<() => TExternalGetter<S, T>, TGetterRegistry<S, T>>;

export type TImmutable<T> = T & {
    [IMMUTABLE_STATE_PROXY_UNWRAP_KEY]: T;
};

export type TCreateGetterArgs<S, I extends TExternalGetter<S>[], C> = [...I, C];

export type TExternalGetter<S, T = unknown> = {
    (state: S | (UnwrapRef<S> & PiniaCustomStateProperties<S>)): T;
    store?: TStore<S, T>;
};

export type TGetterResult<S, T extends TExternalGetter<S>> = ReturnType<T>;

export type TGetterResultList<S, T extends TExternalGetter<S>[]> = {
    [key in keyof T]: T[key] extends TExternalGetter<S> ? TGetterResult<S, T[key]> : never;
};

export type TGetterCombinerArgs<S, I extends TExternalGetter<S>[]> = I extends [] ? [S] : TGetterResultList<S, I>;

export type TAction<S extends StateTree> = {
    (this: Store<string, S, any, any>, ...args: any): any;
};

export type TGetterCombiner<S extends StateTree, I extends TExternalGetter<S>[]> = {
    (this: Store<string, S, any, any>, ...args: TGetterCombinerArgs<S, I>): any;
};

export type TActionCombiner<P extends Store, A extends any[], T> = {
    (this: P, ...args: A): T;
};

export type TExternalAction<P extends Store, A extends any[], T> = {
    (...args: A): T;
    store?: P;
};

export type TExtractState<S, I extends TExternalGetter<S>[], C extends (...args: TGetterCombinerArgs<S, I>) => any> = (
    I extends [] ? Parameters<C>[number] : Parameters<I[number]>[number]
);

export type TAfterCallback<T> = (resolvedReturn: T) => T;

export type TErrorCallback = (error: unknown) => unknown;

export interface IPiniaExtractProperties<S extends StateTree = StateTree> {
    $options: {
        state?: () => S
    };

    /**
     * Defines external getter.
     *
     * Accepts either getter function itself or any amount of input getters, passing their output as arguments to
     * combiner function (last argument) arguments.
     *
     * @param args Any amount of input getters and combiner function as last argument or getter function itself.
     * @returns Data from Pinia store state.
     */
    defineGetter: <I extends TExternalGetter<S>[], C extends TGetterCombiner<S, I>> (
        ...args: TCreateGetterArgs<S, I, C>
    ) => TExternalGetter<TExtractState<S, I, C>, ReturnType<C>>;

    /**
     * Defines external action.
     *
     * @param action Action body.
     */
    defineAction<P extends Store, A extends any[], T>(
        this: P,
        action: TActionCombiner<P, A, T>,
    ): TExternalAction<P, A, T>;
}

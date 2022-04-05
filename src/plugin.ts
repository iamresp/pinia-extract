import {PiniaPluginContext, _Method} from "pinia";

import {addSubscription, triggerSubscriptions} from "./pinia-subscriptions";
import {
    TActionCombiner,
    TAfterCallback,
    TCreateGetterArgs,
    TErrorCallback,
    TExternalAction,
    TExtractState,
    TExternalGetter,
    TGetterCombiner,
    TGetterCombinerArgs,
    TStore,
} from "./types";

let actionSubscriptions = [] as _Method[];

/**
 * Pinia Extract Plugin.
 * Adds `defineGetter` and `defineAction` functions for created stores.
 */
export function PiniaExtractPlugin ({store}: PiniaPluginContext) {
    let isDisposed = false;

    const onAction = store.$onAction.bind(store);
    const dispose = store.$dispose.bind(store);

    return {
        $dispose () {
            isDisposed = true;
            actionSubscriptions = [];
            dispose();
        },
        $onAction <T extends _Method> (callback: T, detached?: boolean, onCleanup?: () => void) {
            const removeSubscription = addSubscription.apply(
                null,
                [actionSubscriptions, callback, detached, onCleanup],
            );
            const removeOriginalSubscription = onAction(callback, detached);

            return () => {
                removeSubscription();
                removeOriginalSubscription();
            };
        },
        defineGetter: <S, I extends TExternalGetter<S>[], C extends TGetterCombiner<S, I>> (
            ...args: TCreateGetterArgs<S, I, C>
        ): TExternalGetter<TExtractState<S, I, C>, ReturnType<C>> => {
            const combiner = args.pop() as C; // last argument is always C
            const getter = (state: TExtractState<S, I, C>) => {
                const combinerArgs = [] as TGetterCombinerArgs<S, I>;

                if (args.length) {
                    // use plain loop instead of .map for applying getters as it's simply faster
                    for (let i = 0; i < args.length; i++) {
                        combinerArgs[i] = (args[i] as I[number])(state); // args[i] is already I[number], C is removed
                    }

                    // sometimes it's important to return the exact value kept in state and not its proxy
                    return combiner.apply(store, combinerArgs) as ReturnType<C>;
                }

                combinerArgs.push(state);

                return combiner.apply(store, combinerArgs) as ReturnType<C>;
            };

            getter.store = store as TStore<TExtractState<S, I, C>, ReturnType<C>>;

            return getter;
        },
        defineAction <A extends any[], T> (
            combiner: TActionCombiner<typeof store, A, T>,
        ): TExternalAction<typeof store, A, ReturnType<typeof combiner>> {
            const action = (...args: A) => {
                if (isDisposed) {
                    throw new ReferenceError("Failed to dispatch action on disposed store.");
                }

                let actionResult: T;
                const afterCallbackList: TAfterCallback<T>[] = [];
                const onErrorCallbackList: TErrorCallback[] = [];

                /* istanbul ignore next */
                function after (callback: typeof afterCallbackList[number]) {
                    afterCallbackList.push(callback);
                }

                /* istanbul ignore next */
                function onError (callback: typeof onErrorCallbackList[number]) {
                    onErrorCallbackList.push(callback);
                }

                triggerSubscriptions(actionSubscriptions, {
                    args,
                    name,
                    store,
                    after,
                    onError,
                });

                try {
                    actionResult = combiner.apply(store, args);
                } catch (error) {
                    triggerSubscriptions(onErrorCallbackList, error);
                    throw error;
                }

                if (actionResult instanceof Promise) {
                    return (actionResult as Promise<T>)
                        .then(value => {
                            triggerSubscriptions(afterCallbackList, value);

                            return value;
                        })
                        .catch(error => {
                            triggerSubscriptions(onErrorCallbackList, error);

                            return Promise.reject(error);
                        });
                }

                // allow the afterCallback to override the return value
                triggerSubscriptions(afterCallbackList, actionResult);

                return actionResult;
            };

            return action as TExternalAction<typeof store, A, ReturnType<typeof combiner>>;
        },
    };
}

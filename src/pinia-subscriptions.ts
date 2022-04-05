import {_Method} from "pinia";
import {getCurrentInstance, onUnmounted} from "vue";

/**
 * Native Pinia function, for simulating native actions behaviour on external actions.
 */
export function addSubscription <T extends _Method> (
    subscriptions: T[],
    callback: T,
    detached?: boolean,
    onCleanup?: () => void,
) {
    subscriptions.push(callback);

    const removeSubscription = () => {
        const idx = subscriptions.indexOf(callback);

        if (idx > -1) {
            subscriptions.splice(idx, 1);
            onCleanup?.();
        }
    };

    if (!detached && getCurrentInstance()) {
        onUnmounted(removeSubscription);
    }

    return removeSubscription;
}

/**
 * Native Pinia function, for simulating native actions behaviour on external actions.
 */
export function triggerSubscriptions <T extends _Method> (
    subscriptions: T[],
    ...args: Parameters<T>
) {
    subscriptions.slice().forEach(callback => {
        callback(...args);
    });
}

import {createPinia, setActivePinia} from "pinia";
import {createApp} from "vue";

import {PiniaExtractPlugin} from "./plugin";

/**
 * Function that allows connecting Pinia Extract and use its features before the Vue app is initiated and mounted.
 * Can wrap existing Pinia instance or create a new one.
 * Instantly installs Pinia Extract instead of adding it to waitlist until Pinia instance is connected to app.
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

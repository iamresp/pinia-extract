import {createPinia, defineStore} from "pinia";
import {createApp} from "vue";

import {
    useGetter,
} from "../src/getters-utils";
import {withExtract} from "../src/pinia-utils";
import {PiniaExtractPlugin} from "../src/plugin";
import {IPiniaExtractProperties} from "../src/types";

declare module "pinia" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface PiniaCustomProperties extends IPiniaExtractProperties {}
}

type TDeepState = {
    data: {
        name?: string;
        codes?: Record<string, number>;
    },
    status?: number;
};

describe("withExtract", () => {

    test("local pinia instance exists, using PiniaExtract features before app initialization", () => {

        const localPinia = createPinia();

        withExtract(localPinia); // activate Extract plugin before app initialization

        const useStore = defineStore("store", {});
        const {defineGetter} = useStore();

        const getRecord = (state: TDeepState) => state.data;

        const getName = defineGetter(
            getRecord,
            data => data.name,
        );

        const LocalApp = {
            setup () {
                const name = useGetter(getName);

                return {name};
            },
            template: "{{name}}",
        };

        const localApp = createApp(LocalApp);

        localPinia.use(PiniaExtractPlugin);
        localApp.use(localPinia);
    });

    test("local pinia instance is created by withExtract, using PiniaExtract features before app initialization", () => {

        const localPinia = withExtract(); // creating a new Pinia by withExtract

        const useStore = defineStore("store", {});
        const {defineGetter} = useStore();

        const getRecord = (state: TDeepState) => state.data;

        const getName = defineGetter(
            getRecord,
            data => data.name,
        );

        const LocalApp = {
            setup () {
                const name = useGetter(getName);

                return {name};
            },
            template: "{{name}}",
        };

        const localApp = createApp(LocalApp);

        localPinia.use(PiniaExtractPlugin);
        localApp.use(localPinia);
    });

});

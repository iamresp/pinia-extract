import {mount} from "@vue/test-utils";
import {createPinia, defineStore, setActivePinia} from "pinia";
import {createApp, defineComponent} from "vue";

import {
    useGetter,
} from "../src/getters-utils";
import {postponed, withExtract} from "../src/pinia-utils";
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

        const useStore = defineStore("store", {
            state: () => ({
                data: {
                    name: "test",
                },
            }),
        });
        const store = useStore();

        const getRecord = (state: TDeepState) => state.data;

        const getName = store.defineGetter(
            getRecord,
            data => data.name,
        );

        const setName = store.defineAction(
            function (name: string) {
                this.data.name = name;
            },
        );

        const LocalApp = {};

        const TestComponent = defineComponent({
            setup () {
                const name = useGetter(getName);

                expect(name.value).toBe("test");
                setName("test2");
                expect(name.value).toBe("test2");

                return {name};
            },
            template: "{{name}}",
        });

        const localApp = createApp(LocalApp);

        localPinia.use(PiniaExtractPlugin);
        localApp.use(localPinia);

        mount(TestComponent);
    });

    test("local pinia instance is created by withExtract, using PiniaExtract features before app initialization", () => {

        const localPinia = withExtract(); // creating a new Pinia by withExtract

        const useStore = defineStore("store", {
            state: () => ({
                data: {
                    name: "test",
                },
            }),
        });
        const store = useStore();

        const getRecord = (state: TDeepState) => state.data;

        const getName = store.defineGetter(
            getRecord,
            data => data.name,
        );

        const setName = store.defineAction(
            function (name: string) {
                this.data.name = name;
            },
        );

        const LocalApp = {};

        const TestComponent = defineComponent({
            setup () {
                const name = useGetter(getName);

                expect(name.value).toBe("test");
                setName("test2");
                expect(name.value).toBe("test2");

                return {name};
            },
            template: "{{name}}",
        });

        const localApp = createApp(LocalApp);

        localPinia.use(PiniaExtractPlugin);
        localApp.use(localPinia);

        mount(TestComponent);
    });

});

describe("postponed", () => {

    test("postponed getter returns undefined if no active pinia is present", () => {
        setActivePinia(undefined);

        const useStore = defineStore("store", {
            state: () => ({
                data: {
                    name: "test",
                },
            }),
        });
        const store = postponed(useStore);

        const getRecord = (state: TDeepState) => state.data;

        const getName = store.defineGetter(
            getRecord,
            data => data?.name,
        );

        const TestComponent = defineComponent({
            setup () {
                const name = useGetter(getName);

                expect(() => {
                    expect(name.value).toBe(undefined);
                }).not.toThrow();

                return {name};
            },
            template: "{{name}}",
        });

        createApp({});
        mount(TestComponent);
    });

    test("postponed action does not modify store if no active pinia is present", () => {
        setActivePinia(undefined);

        const useStore = defineStore("store", {
            state: () => ({
                data: {
                    name: "test",
                },
            }),
        });
        const store = postponed(useStore);

        const getRecord = (state: TDeepState) => state.data;

        const getName = store.defineGetter(
            getRecord,
            data => data?.name,
        );

        const setName = store.defineAction(
            function (name: string) {
                this.data.name = name;
            },
        );

        const TestComponent = defineComponent({
            setup () {
                const name = useGetter(getName);

                expect(() => {
                    expect(name.value).toBe(undefined);
                    setName("test2");
                    expect(name.value).toBe(undefined);
                }).not.toThrow();

                return {name};
            },
            template: "{{name}}",
        });

        createApp({});
        mount(TestComponent);
    });

    test("if no active pinia instance is present, postponed actions do not run", () => {
        setActivePinia(undefined);

        const useStore = defineStore("store", {
            state: () => ({
                data: {
                    name: "test",
                },
            }),
        });
        const store = postponed(useStore);

        const setName = store.defineAction(
            function (_: string) {
                throw new Error("Error in postponed action");
            },
        );

        expect(() => setName("test202")).not.toThrow("Error in postponed action");
    });

    test("if no active pinia instance is present, store bound to getters is mocked", () => {
        setActivePinia(undefined);

        const useStore = defineStore("store", {
            state: () => ({
                data: {
                    name: "test",
                },
            }),
        });
        const store = postponed(useStore);

        const getRecord = (state: TDeepState) => state.data;

        const getName = store.defineGetter(
            getRecord,
            data => data?.name,
        );

        const boundStore = getName.store;

        // mocked boundStore has all normal store methods and fields

        expect(typeof boundStore.$id).toBe("symbol");
        expect(boundStore.$options).toEqual({});
        expect(boundStore.$state).toEqual({});
        expect(boundStore._customProperties).toEqual(new Set());
        expect(() => {
            const action = boundStore.defineAction(
                function () {
                    throw new Error("Error in postponed action");
                },
            );
            const getter = boundStore.defineGetter(
                getRecord,
                data => data?.name,
            );

            expect(action).not.toThrow("Error in postponed action");
            expect(getter(boundStore.$state)).toBe(undefined);

            const removeActionHandler = boundStore.$onAction(() => {});
            const removeSubscriptionHandler = boundStore.$subscribe(() => {});

            removeActionHandler();
            removeSubscriptionHandler();

            boundStore.$patch({data: null});
            boundStore.$reset();
            boundStore.$dispose();
        }).not.toThrow();
    });

    test("postponed definitions work normally after app is mounted", () => {
        setActivePinia(undefined);

        const useStore = defineStore("store", {
            state: () => ({
                data: {
                    name: "test",
                },
            }),
        });
        const store = postponed(useStore);

        const getRecord = (state: TDeepState) => state.data;

        const getName = store.defineGetter(
            getRecord,
            data => data?.name,
        );

        const setName = store.defineAction(
            function (name: string) {
                this.data.name = name;
            },
        );

        const TestComponent = defineComponent({
            setup () {
                const name = useGetter(getName);

                expect(name.value).toBe("test");
                setName("test35");
                expect(name.value).toBe("test35");

                return {name};
            },
            template: "{{name}}",
        });

        const LocalApp = {};

        const localApp = createApp(LocalApp);
        const localPinia = createPinia();

        localPinia.use(PiniaExtractPlugin);
        localApp.use(localPinia);

        mount(TestComponent);
    });

});


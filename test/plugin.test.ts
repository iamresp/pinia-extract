import {mount} from "@vue/test-utils";
import {setActivePinia, createPinia, defineStore} from "pinia";
import {createApp} from "vue";

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

/**
 * Expecting 1 million of calls to take less than 1 second for each of the following:
 * - `defineGetter`;
 * - getter call without composition functions;
 */
const PERF_TEST_TIME = 1e3;
const PERF_TEST_DEFINE_GETTER_TARGET = 1e6;
const PERF_TEST_GETTER_USAGE_TARGET = 1e6;

let app;

beforeEach(() => {
    const pinia = createPinia().use(PiniaExtractPlugin);

    app = createApp({});
    app.use(pinia);
    setActivePinia(pinia);
});

describe("defineGetter", () => {

    test("one dependency, dependency is a pure getter", () => {

        const useStore = defineStore("store", {});
        const {defineGetter} = useStore();

        const states: TDeepState[] = [
            {
                data: {
                    name: "A",
                },
            },
            {
                data: {
                    name: "B",
                },
            },
            {
                data: {
                    name: "C",
                },
            },
        ];

        const getRecord = (state: TDeepState) => state.data;

        const getName = defineGetter(
            getRecord,
            data => data.name,
        );

        expect(getName(states[0])).toBe("A");
        expect(getName(states[1])).toBe("B");
        expect(getName(states[2])).toBe("C");
    });

    test("two dependencies, dependencies are pure and created getter", () => {

        const useStore = defineStore("store", {});
        const {defineGetter} = useStore();

        const getData = (state: TDeepState) => state.data;
        const getStatus = (state: TDeepState) => state.status;

        const getCodes = defineGetter(
            getData,
            data => data.codes,
        );

        const getCodeA = defineGetter(
            getCodes,
            codes => codes.a,
        );

        const getSum = defineGetter(
            getStatus,
            getCodeA,
            (status, a) => status + a,
        );

        const states: TDeepState[] = [
            {
                data: {
                    codes: {
                        a: 2,
                    },
                },
                status: 1,
            },
            {
                data: {
                    codes: {
                        a: 5,
                    },
                },
                status: 3,
            },
        ];

        expect(getSum(states[0])).toBe(3);
        expect(getSum(states[1])).toBe(8);
    });

    test("performance test - creating", () => {

        const useStore = defineStore("store", {});
        const {defineGetter} = useStore();

        let time = 0;
        const getData = (state: TDeepState) => state.data;
        const start = performance.now();

        for (let i = 0; i < PERF_TEST_DEFINE_GETTER_TARGET; i++) {
            defineGetter(
                getData,
                data => data.codes,
            );
        }

        time = performance.now() - start;
        expect(time).toBeLessThan(PERF_TEST_TIME);
    });

    test("performance test - usage", () => {

        const useStore = defineStore("store", {});
        const {defineGetter} = useStore();

        let time = 0;
        const start = performance.now();
        const getData = (state: TDeepState) => state.data;
        const getter = defineGetter(
            getData,
            data => data.codes,
        );
        const state = {
            data: {
                codes: {
                    a: 2,
                },
            },
            status: 1,
        };

        for (let i = 0; i < PERF_TEST_GETTER_USAGE_TARGET; i++) {
            getter(state);
        }

        time = performance.now() - start;
        expect(time).toBeLessThan(PERF_TEST_TIME);
    });
});

describe("defineAction", () => {

    test("base case, simple value setter", () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 5,
            }),
        });

        const store = useStore();

        const setA = store.defineAction(
            function (a: number) {
                this.a = a;

                return a;
            },
        );

        setA(10);

        expect(store.a).toBe(10);
    });

    test("error in combiner is thrown by external action", () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 5,
            }),
        });

        const store = useStore();

        const setA = store.defineAction(
            function (a: number) {
                this.a = a;

                throw new Error("Error!");
            },
        );

        expect(() => {
            setA(10);
        }).toThrow("Error!");
    });

    test("async action", async () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 5,
            }),
        });

        const store = useStore();

        const setA = store.defineAction(
            async function (a: number) {
                return await new Promise(resolve => {
                    setTimeout(() => {
                        this.a = a;
                        resolve(a);
                    }, 10);
                });
            },
        );

        await setA(10);

        expect(store.a).toBe(10);
    });

    test("rejection in combiner returned promise proceeds to external action rejection", async () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 5,
            }),
        });

        const store = useStore();

        const setA = store.defineAction(
            async function (a: number) {
                return await new Promise((_, reject) => {
                    setTimeout(() => {
                        this.a = a;
                        reject("Error!");
                    }, 10);
                });
            },
        );

        try {
            await setA(10);
        } catch (e) {
            expect(e).toBe("Error!");
        }
    });

});

describe("$onAction", () => {

    test("action event handler, invoked for native and external actions both", () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 0,
                b: 0,
            }),
            actions: {
                setA (a: number) {
                    this.a = a;
                },
            },
        });

        const store = useStore();
        const actionHandler = jest.fn();

        store.$onAction(actionHandler);

        const setB = store.defineAction(
            function (b: number) {
                this.b = b;

                return b;
            },
        );

        const component = {
            setup () {

                store.setA(10);
                setB(20);

                return {store};
            },
            template: "{{store.a}}, {{store.b}}",
        };

        const wrapper = mount(component);

        expect(wrapper.html()).toContain("10, 20");
        expect(actionHandler).toBeCalledTimes(2);
    });

    test("function returned by $onAction handler removes action listener", () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 0,
                b: 0,
            }),
            actions: {
                setA (a: number) {
                    this.a = a;
                },
            },
        });

        const store = useStore();
        const actionHandler = jest.fn();

        const removeActionHandler = store.$onAction(actionHandler);

        const setB = store.defineAction(
            function (b: number) {
                this.b = b;

                return b;
            },
        );

        const component = {
            setup () {

                store.setA(10);
                setB(20);

                removeActionHandler();

                store.setA(50);
                setB(60);

                return {store};
            },
            template: "{{store.a}}, {{store.b}}",
        };

        const wrapper = mount(component);

        expect(wrapper.html()).toContain("50, 60");
        expect(actionHandler).toBeCalledTimes(2);
    });

    test("on component unmount, action handlers defined inside a component are removed", () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 0,
                b: 0,
            }),
            actions: {
                setA (a: number) {
                    this.a = a;
                },
            },
        });

        const store = useStore();
        const actionHandler = jest.fn();

        const setB = store.defineAction(
            function (b: number) {
                this.b = b;

                return b;
            },
        );

        const component = {
            setup () {

                store.$onAction(actionHandler);

                store.setA(10);
                setB(20);

                return {store};
            },
            template: "{{store.a}}, {{store.b}}",
        };

        const wrapper = mount(component);

        expect(wrapper.html()).toContain("10, 20");

        wrapper.unmount();

        store.setA(50);
        setB(60);

        expect(actionHandler).toBeCalledTimes(2);
    });

});

describe("$dispose", () => {

    test("attempt to dispatch action on disposed store throws a ReferenceError", () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 0,
                b: 0,
            }),
        });

        const store = useStore();

        const setB = store.defineAction(
            function (b: number) {
                this.b = b;

                return b;
            },
        );

        setB(10);

        store.$dispose();

        expect(() => {
            setB(20);
        }).toThrowError(ReferenceError("Failed to dispatch action on disposed store."));

    });

    test("$onAction handlers are discontinued for disposed store", () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 0,
                b: 0,
            }),
        });

        const store = useStore();
        const actionHandler = jest.fn();

        store.$onAction(actionHandler);

        const setB = store.defineAction(
            function (b: number) {
                this.b = b;

                return b;
            },
        );

        setB(10);

        store.$dispose();

        expect(() => {
            setB(20);
        }).toThrow();

        expect(actionHandler).toBeCalledTimes(1);
    });

});

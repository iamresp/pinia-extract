import {mount} from "@vue/test-utils";
import {setActivePinia, createPinia, defineStore} from "pinia";
import {createApp, ref} from "vue";

import {
    useGetter,
    useGetterFactory,
} from "../src/getters-utils";
import {PiniaExtractPlugin} from "../src/plugin";
import {IPiniaExtractProperties} from "../src/types";

declare module "pinia" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface PiniaCustomProperties extends IPiniaExtractProperties {}
}

type TSimpleState = {
    a: number;
    b: number;
};

type TDeepState = {
    data: {
        name?: string;
        codes?: Record<string, number>;
    },
    status?: number;
};

/**
 * Expecting 100 000 of calls to take less than 1 second for each of the following:
 * - `useGetter`;
 * - `useGetterFactory`.
 */
const PERF_TEST_TIME = 1e3;
const PERF_TEST_USE_GETTER_TARGET = 1e5;
const PERF_TEST_USE_GETTER_FACTORY_TARGET = 1e5;

let app;

beforeEach(() => {
    const pinia = createPinia().use(PiniaExtractPlugin);

    app = createApp({});
    app.use(pinia);
    setActivePinia(pinia);
});

describe("useGetter", () => {

    test("using getter in component", () => {

        const useStore = defineStore<string, TSimpleState>("store", {
            state: () => ({
                a: 3,
                b: 3,
            }),
        });

        const {defineGetter} = useStore();

        const getA = (state: TSimpleState) => state.a;
        const getB = (state: TSimpleState) => state.b;

        const getMultiplication = defineGetter(
            getA,
            getB,
            (a, b) => a * b,
        );

        const component = {
            setup () {
                const result = useGetter(getMultiplication);

                return {result};
            },
            template: "{{result}}",
        };

        const wrapper = mount(component);

        expect(wrapper.html()).toContain("9");
    });

    test("performance test", () => {

        const useStore = defineStore<string, TSimpleState>("store", {
            state: () => ({
                a: 1,
                b: 2,
            }),
        });

        const {defineGetter} = useStore();

        let time = 0;

        const getA = (state: TSimpleState) => state.a;
        const getB = (state: TSimpleState) => state.b;

        const getSum = defineGetter(
            getA,
            getB,
            (a, b) => a + b,
        );

        const component = {
            setup () {
                const start = performance.now();

                for (let i = 0; i < PERF_TEST_USE_GETTER_TARGET; i++) {
                    useGetter(getSum);
                }

                time = performance.now() - start;

            },
            template: "<div />",
        };

        mount(component);

        expect(time).toBeLessThan(PERF_TEST_TIME);
    });

    test("data mutation attempt inside getter", () => {

        const useStore = defineStore<string, TDeepState>("store", {
            state: () => ({
                data: {
                    codes: {
                        a: 2,
                    },
                },
            }),
        });

        const {defineGetter} = useStore();

        const getData = (state: TDeepState) => state.data;
        const getCodes = defineGetter(
            getData,
            data => {
                data.codes = null;

                return data.codes;
            },
        );

        const component = {
            setup () {
                let result;

                expect(() => {
                    const codes = useGetter(getCodes);

                    result = codes.value;

                }).toThrowError(ReferenceError("Mutations in getters are not allowed."));

                return {result};
            },
            template: "{{result}}",
        };

        mount(component);
    });

    test("data mutation outside getter", () => {

        const useStore = defineStore<string, TDeepState>("store", {
            state: () => ({
                data: {
                    codes: {
                        a: 2,
                    },
                },
            }),
        });

        const {defineGetter} = useStore();
        const getData = defineGetter((state: TDeepState) => state.data);

        const component = {
            setup () {
                const data = useGetter(getData);

                expect(() => {
                    data.value.codes.a = 3;
                }).not.toThrow("Mutations in getters are not allowed.");
                expect(data.value.codes.a).toBe(3);
            },
            template: "<div />",
        };

        mount(component);
    });

    test("externally created action as setter", () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 1,
            }),
        });

        const store = useStore();

        const setA = store.defineAction(
            function (a: number, b: number) {
                this.a = a + b;
            },
        );
        const getter = store.defineGetter((state: TSimpleState) => state.a);

        const actionSpy = jest.fn(setA);

        const component = {
            setup () {
                const code = useGetter(getter, actionSpy, 20);

                code.value = 10;

                expect(code.value).toBe(30);

                return {code};
            },
            template: "{{code}}",
        };

        mount(component);
        expect(actionSpy).toHaveBeenCalledWith(10, 20);
    });

    test("action as setter calls optimization", () => {

        const useStore = defineStore("store", {
            state: () => ({
                a: 1,
            }),
        });

        const store = useStore();

        const setA = store.defineAction(
            function (a: number) {
                this.a = a;

                return a;
            },
        );
        const getter = store.defineGetter((state: TSimpleState) => state.a);

        const actionSpy = jest.fn(setA);

        const component = {
            setup () {
                const code = useGetter(getter, actionSpy);

                for (let i = 0; i < 5; i++) {
                    code.value = 10;
                }

                // is value set correctly
                expect(code.value).toBe(10);

                return {code};
            },
            template: "{{code}}",
        };

        mount(component);
        // was action called only once
        expect(actionSpy).toHaveBeenCalledTimes(1);
    });

});

describe("useGetterFactory", () => {

    test("using getter factory with primitive argument", () => {

        const useStore = defineStore<string, TSimpleState>("store", {
            state: () => ({
                a: 2,
                b: 2,
            }),
        });

        const {defineGetter} = useStore();

        const getA = (state: TSimpleState) => state.a;
        const getB = (state: TSimpleState) => state.b;

        const createGetMultiplication = (c: number) => defineGetter(
            getA,
            getB,
            (a, b) => a * b * c,
        );

        const component = {
            setup () {
                const result = useGetterFactory(createGetMultiplication, 10);

                return {result};
            },
            template: "{{result}}",
        };

        const wrapper = mount(component);

        expect(wrapper.html()).toContain("40");
    });

    test("using getter factory with object type argument", () => {

        const useStore = defineStore<string, TSimpleState>("store", {
            state: () => ({
                a: 2,
                b: 2,
            }),
        });

        const {defineGetter} = useStore();

        const getA = (state: TSimpleState) => state.a;
        const getB = (state: TSimpleState) => state.b;

        const createGetMultiplication = ({c, d}: Record<string, number>) => defineGetter(
            getA,
            getB,
            (a, b) => a * b * c * d,
        );

        const component = {
            setup () {
                const result = useGetterFactory(createGetMultiplication, {c: 10, d: 20});

                return {result};
            },
            template: "{{result}}",
        };

        const wrapper = mount(component);

        expect(wrapper.html()).toContain("800");
    });

    test("using getter factory with primitive ref argument", () => {

        const useStore = defineStore<string, TSimpleState>("store", {
            state: () => ({
                a: 2,
                b: 2,
            }),
        });

        const {defineGetter} = useStore();

        const getA = (state: TSimpleState) => state.a;
        const getB = (state: TSimpleState) => state.b;

        const createGetMultiplication = (c: number) => defineGetter(
            getA,
            getB,
            (a, b) => a * b * c,
        );

        const component = {
            setup () {
                const multiplier = ref<number>(10);
                const result = useGetterFactory(createGetMultiplication, multiplier);

                return {result};
            },
            template: "{{result}}",
        };

        const wrapper = mount(component);

        expect(wrapper.html()).toContain("40");
    });

    test("using getter factory with object ref argument", () => {

        const useStore = defineStore<string, TSimpleState>("store", {
            state: () => ({
                a: 2,
                b: 2,
            }),
        });

        const {defineGetter} = useStore();

        const getA = (state: TSimpleState) => state.a;

        const createGetMultiplication = (object: TSimpleState) => defineGetter(
            getA,
            a => a * object.a,
        );

        const component = {
            setup () {
                const object = ref<TSimpleState>({a: 5, b: 5});
                const result = useGetterFactory(createGetMultiplication, object);

                return {result};
            },
            template: "{{result}}",
        };

        const wrapper = mount(component);

        expect(wrapper.html()).toContain("10");
    });

    test("data mutation outside getter factory", () => {

        const useStore = defineStore<string, TDeepState>("store", {
            state: () => ({
                data: {
                    codes: {
                        a: 2,
                    },
                },
            }),
        });

        const {defineGetter} = useStore();

        const createGetData = (hasAccess: boolean) => (
            defineGetter((state: TDeepState) => hasAccess ? state.data : null)
        );

        const component = {
            setup () {
                const data = useGetterFactory(createGetData, true);

                expect(() => {
                    data.value.codes.a = 3;
                }).not.toThrow("Mutations in getters are not allowed.");
                expect(data.value.codes.a).toBe(3);
            },
            template: "<div />",
        };

        mount(component);
    });

    test("performance test", () => {

        const useStore = defineStore<string, TDeepState>("store", {
            state: () => ({
                data: {
                    codes: {
                        a: 2,
                    },
                },
            }),
        });

        const {defineGetter} = useStore();

        let time = 0;

        const getData = (state: TDeepState) => state.data;

        const createGetCodes = (hasAccess: boolean) => defineGetter(
            getData,
            data => hasAccess ? data.codes : null,
        );

        const component = {
            setup () {
                const start = performance.now();
                const hasAccess = ref<boolean>(true);

                for (let i = 0; i < PERF_TEST_USE_GETTER_FACTORY_TARGET; i++) {
                    useGetterFactory(createGetCodes, hasAccess);
                }

                time = performance.now() - start;
            },
            template: "<div />",
        };

        mount(component);

        expect(time).toBeLessThan(PERF_TEST_TIME);
    });

});

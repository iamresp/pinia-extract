# Pinia Extract

Pinia actions and getters that can be defined anywhere outside of store.

[![Coverage Status](https://coveralls.io/repos/github/iamresp/pinia-extract/badge.svg?branch=develop)](https://coveralls.io/github/iamresp/pinia-extract?branch=develop)

## Installation

Use `npm` or `yarn` to install:

```bash
npm i pinia-extract
```
or
```bash
yarn add pinia-extract
```

Then enable a plugin the way it is recommended in Pinia documentation:

```typescript
import {createPinia} from "pinia";
import {IPiniaExtractProperties, PiniaExtractPlugin} from "pinia-extract";

const pinia = createPinia();
pinia.use(PiniaExtractPlugin);

declare module "pinia" {
    export interface PiniaCustomProperties extends IPiniaExtractProperties {}
}
```

## External vs. Internal

By default, actions and getters can be defined for Pinia store in the store object itself. This works well for compact stores, but may appear to be a problem when it comes to stores with tens or even hundreds of actions or getters — then we have an thousands-liner object that is difficult to read and maintain.

In other state management libraries (Vuex, Redux) it is possible to define actions outside of store — and this is really helpful in large scale projects. This library adds the possibility to do so for Pinia.

## Postponed definitions

Normally Pinia stores are being initialized only after Pinia instance is activated, potentially causing errors on attempt to use some store before Pinia's installation.

In other words, when we create separate files for actions or getters and just try to use store definition composable (result of `defineStore`) to get definition functions, most likely first `defineGetter` / `defineAction` call will end up with error thrown.

To avoid this, Pinia Extract provides `postponed` function. It takes store definition composable and creates a wrapper over this store, that exposes `defineAction` and `defineGetter` which both work at any time before or after Pinia is initialized.

As function name supposes, definitions made by stores wrapped with it are postponed: until Pinia is initialized, external actions and getters defined with postponed defintions are disabled. Getters always return `undefined`, actions don't actually run. They start work normal way right after Pinia is installed:

```typescript
pinia.use(PiniaExtractPlugin); // Pinia Extract must be installed first
app.use(pinia); // then Pinia itself is installed for current app
app.mount("#app"); // and finally app is mounted
```

If you mount your app **after** installing Pinia and Pinia Extract, then external actions and getters created with Pinia Extract will work right in every component's `created` lifecycle stage.

Currently `postponed` is a recommended way to define external actions and getters with Pinia Extract.

## External actions

External actions work the same way as native actions do:

```typescript
import {postponed} from "pinia-extract";
import {useSomeStore} from "./store";

const store = postponed(useSomeStore);

export const requestGetCar = store.defineAction(
    async function (id: string) {
        const car = await fetch(`/api/cars/${id}`);
        this.car = await car.json();
    }
);
```

`defineAction` should always be called as a property of store (either normal or wrapped with `postponed`). Extracting it with destructuring assignment will cause it throw a binding error.

The single argument of `defineAction` is an action function itself. It must be a classic function to have a context of store.

The result of `defineAction` is always a bind-safe independent function that can be safely called or passed as an argument to other functions.

```typescript
await requestGetCar(id); // that's it!
someFunction(requestGetCar); // no binding errors
```

## External getters

Technically all getters (native and external) are functions that take state as an argument and return data from it:

```typescript
import {postponed} from "pinia-extract";
import {useSomeStore} from "./store";

const store = postponed(useSomeStore);
export const getCar = store.defineGetter((state: TState): TCar => state.car);
```

Alongside with `defineAction`, Pinia Extract Plugin provides `defineGetter` function that is explicitly connected to each store. It can work in two different ways. When `defineGetter` receives only one argument, it must be a *direct getter function* that takes a state as an argument and returns some data from this state:

```typescript
import {postponed} from "pinia-extract";
import {useStore} from "./store";

// unlike `defineAction`, `defineGetter` can be extracted with destructuring assignment
const {defineGetter} = postponed(useStore);

// direct getter - state argument, returns data from state
export const getCustomer = defineGetter((state: TState) => state.customer);
/**
 * `getCustomer` is a function that takes state as an argument and return `state.customer`.
 */
```

Another way to define exernal getter is a bit more complex. It works similarly to [Reselect](https://github.com/reduxjs/reselect/)'s `createSelector`: getters defined with this function can use other getters as an input, thus operating not the whole state, but exact granular data retrieved by their input getters.
`defineGetter` takes any amount of arguments. The last argument is always a *combiner function* that takes the exact amount of agruments as an amount of given input getters. Arguments of combiner function are return values of input getters, passed always in the same order as input getters.

```typescript
import {postponed} from "pinia-extract";
import {useStore} from "./store";

const {defineGetter} = postponed(useStore);

// direct getter
export const getCustomer = defineGetter((state: TState) => state.customer);

// another direct getter
export const getCar = defineGetter((state: TState) => state.car);

// getter that uses another getter as a dependency
export const getCustomerName = defineGetter(
    getCustomer, // dependency
    (customer: TCustomer): string => customer.name; // combiner function
);
/**
 * `getCustomerName` is still a function that takes state as an argument and return `state.customer.name`.
 * Combiner function above isn't exactly the getter itself. The difference with direct / native getters is that such
 * complex external getter calls its combiner and dependencies to retrieve required state data.
 * State instance passed to the `getCustomerName` on its call is also passed further to `getCustomer` to retrieve
 * dependency data. Thus, state is a single source of truth for called getter and all of its dependencies.
 */

export const getCustomerJobTitle = defineGetter(
    getCustomer,
    (customer: TCustomer): string => customer.jobTitle;
);

export const getCarModel = defineGetter(
    getCar,
    (car: TCar): string => car.model;
);

export const getCarType = defineGetter(
    getCar,
    (car: TCar): string => car.type;
);

// getter that uses multiple getters as input
export const getCustomerCar = defineGetter(
    getCustomerJobTitle,
    getCustomerName,
    getCarModel,
    getCarType,
    // each argument of combiner function is a result of a respective dependency getter specified above
    (
        jobTitle: string,
        name: string,
        model: string,
        carType: string,
    ): string => `${jobTitle} ${name} drives ${model} ${type}`;
);
```

When we call external getters with dependencies, it does following things:

1) `getCustomerCar` called, store's state as an argument
2) each dependency called (`getCustomerJobTitle`, `getCustomerName`, `getCarModel`, `getCarType`), store's state as an argument
3) combiner called, return values of dependencies as arguments
4) return value of combiner returned by `getCustomerCar`.

## Using getters

There are two functions provided by plugin for applying getters in Vue components: `useGetter` and `useGetterFactory`.

First one is meant to work directly with getters created with `defineGetter`:

```typescript
setup () {
    const customerCar = useGetter(getCustomerCar);
    // ...
}
```

`useGetter` returns Vue's native `ComputedRef`, exactly as `computed` function that it wraps over.

### Setters for external getters

As it stated above, `useGetter` is a wrapper over `computed` function. Similarly to `computed`, it allows to specify a setter to the value returned by getter.

Normally it's assumed to be a store action, either native or external. For native actions in will require to invoke store composition function and bind action, external actions can be passed without additional preparations.

```typescript
setup () {
    const store = useStore(); // needed only for native action setter
    const customerCar = useGetter(getCustomerCar, store.setCustomerCar.bind(store)); // with native action
    const customerName = useGetter(getCustomerName, setCustomerName); // with external action

    customerName.value = "Alex"; // will call `setCustomerName("Alex")`.
    // ...
}
```

All other arguments passed to `useGetter` will be passed to the setter function after new value.

```typescript
setup () {
    const customerName = useGetter(getCustomerName, setCustomerName, "Stone");

    customerName.value = "Alex"; // will call `setCustomerName("Alex", "Stone")`.
    // ...
}
```

Setter function calls are optimized. If call passes the same value as previous call did, setter is not called again.

### Using direct getters

By the concept, direct getters are mostly meant to be used as dependencies for other getters that decompose data further. If you using your direct getters only like this and not using them in components directly, you can simplify your code by omitting a `defineGetter` call and just define direct getter as a function:

```typescript
// file with getters
// assume that we do not use getCustomer in Vue component, so `defineGetter` can be omitted
export const getCustomer = (state: TState) => state.customer;

export const getCustomerName = defineGetter(
    getCustomer, // dependency accepted and typed correctly as any other getter
    (customer: TCustomer): string => customer.name; // works correctly
);

// component
setup () {
    const customerName = useGetter(getCustomerName); // will NOT throw an error
    // But if we attempt to use direct getter defined without `defineGetter`...
    const customer = useGetter(getCustomer); // will throw an error - store not bound
    // ...
}
```

It's simple: your direct getter is used in some Vue component? Use `defineGetter` to define it. No? You can avoid it.

### Getter factories

Another option for using getters in components is `useGetterFactory`. It is meant to be used with getter factories — higher order functions that take any arguments and return getters (that supposedly use factory arguments somehow). On call, it applies given getter factory with passed arguments and then instantly applies returned getter.

```typescript
// file with getters

export const getCustomers = (state: TState) => state.customers;
// factory - function that returns external getter
export const createGetCustomer = (customerId: string) => defineGetter(
    getCustomers,
    (customers) => customers.find(({id}) => customerId === id),
);

// component
setup () {
    // useGetterFactory(factory, ...args)
    const customer = useGetterFactory(createGetCustomer, "100032"); // "100032" is passed as `customerId`
    // ...
}
```

All `useGetterFactory` arguments after the first one (getter factory to be used) are factory arguments to be passed on factory call.

Like `useGetter`, `useGetterFactory` provides memoization. Results of each factory for every list of arguments are being memoized — but only if all arguments in list are either primitives or Vue refs of primitives.

```typescript

setup () {
    const someRef = ref<boolean>(true);
    const handleSomething = (event: Event) => {
        doSomething(event);
    }
    const firstData = useGetterFactory(getterFactory, 1, true, "not"); // will be memoized
    const secondData = useGetterFactory(getterFactory, someRef); // will be memoized (with current ref value)
    const secondData = useGetterFactory(getterFactory, handleSomething); // will NOT be memoized
    const secondData = useGetterFactory(getterFactory, [1, 2, 3]); // will NOT be memoized
    const secondData = useGetterFactory(getterFactory, {a: 5}); // will NOT be memoized
    // ...
}
```

## Immutability

One more thing implemented by plugin API is a deeply immutable state.

Since memoization provided by `useGetter` and `useGetterFactory` implies that getters are pure functions, state instance provided by it is deeply immutable. Any attempt to perform state mutations in getter function will immediately throw an error.

This guarantees correct memoization for all getters and getter factories. Thus, all mutations of data retrieved by getters must be done outside of getters only.

## Summary overview

Solved problems:

- Pinia is made to keep everything in one place — state, actions, getters. If your project is large enough, the store can quickly overgrow. With this plugin, your actions and getters can be kept separated from the store — and still provide good typings;
- Native Pinia getters always have a full access to store's state, so it's easy to lose granularity — especially when you work with complex objects kept in store — and write a "simple" getter that does a good million of things;
- Side effects caused by mutations in getters.

Added features:

- Memoization that helps to avoid creating and using the very same things more than needed;
- API for using getters that wraps native `computed` composition function;
- Compositive API for selecting data from store state — external getters are not meant to take everything from state no matter how deep desired data lies — instead, it's about using a composition when getters can use each other to retrieve the data;
- External getters operate deeply immutable store which strictly prohibits any mutations — they are meant to retrieve data, but not modify it;
- Similar to native `computed` function, `useGetter` API allows to specify a computed setter for the data that getter receives;
- `useGetterFactory` API for passing additional arguments for getters with Higher Order Functions;
- Strong and transparent Typescript typings for things kept outside of store.

See anything you might need in your work? Well then, you welcome!
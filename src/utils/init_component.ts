import { Component } from "../abstracts";
import { Logger, nextTick } from "../utils";
import { ERROR_TYPE, LIFECYCLE_EVENT } from "../enums";
import { handleAttribute, handleDirective, runPromisesInSequence } from "../helpers";

export function initComponent(this: Component, component: Component, option) {

    const htmlAttributes = handleAttribute.call(this, component, option.attr, true);
    handleDirective.call(this, component, option.dir, true);
    if (option.on) {
        const events = option.on;
        for (const eventName in events) {
            const ev = events[eventName];
            const methods = [];
            ev.handlers.forEach(item => {
                if (item != null) {
                    methods.push(item.bind(this));
                }
                else {
                    new Logger(ERROR_TYPE.InvalidEventHandler, {
                        eventName,
                    }).logPlainError();
                }
            });
            component.on(eventName, (args) => {
                runPromisesInSequence(methods, args);
            });
        }
    }
    const computed = component['_computed'];
    for (const key in computed) {
        const data = computed[key];
        let computedValue = data.fn.call(component);
        Object.defineProperty(component, key, {
            get() {
                return computedValue;
            },
            set(newValue) {
                // component.setState(key, newValue, computedValue);
                computedValue = newValue;
            }
        })
        data.args.forEach(arg => {
            component.watch(arg, () => {
                const newValue = data.fn.call(component);
                component.setState(key, newValue, computedValue);
                computedValue = newValue;
            });
        });
    }
    // attachGetterSetter(component);
    component.emit(LIFECYCLE_EVENT.Create);
    component.on(LIFECYCLE_EVENT.Destroy, () => {
        component = null;
    });
    return htmlAttributes;
}
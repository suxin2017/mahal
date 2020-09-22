import { isArray, isNull, isPrimitive, getObjectLength } from "../utils";
import { nextTick } from "../utils";
import { isObject } from "util";
export class Observer {


    onChange: (key: string, oldValue, newValue) => void

    create(input: object, keys?: string[], prefix = "") {
        const cached = {};
        const onChange = this.onChange;
        if (isArray(input)) {
            keys = keys || ["push", "splice"]
            keys.forEach(key => {
                cached[key] = this[key];
                Object.defineProperty(input, key, {
                    value: function (...args) {
                        let result = Array.prototype[key].apply(this, args);
                        nextTick(() => {
                            onChange(prefix + key, (() => {
                                switch (key) {
                                    case 'push':
                                        // return args[0];
                                        return {
                                            value: args[0],
                                            key: result - 1,
                                            length: result
                                        }
                                    default:
                                        return args;
                                }
                            })(), null);
                        });
                        return result;
                    }
                });
            })
            return;
        }
        keys = keys || Object.keys(input);

        keys.forEach(key => {
            cached[key] = input[key];
            Object.defineProperty(input, key, {
                set(newValue) {
                    const oldValue = cached[key];
                    cached[key] = newValue;
                    nextTick(() => {
                        onChange(prefix + key, oldValue, newValue);
                    })
                },
                get() {
                    return cached[key];
                }

            });

            if (isObject(input[key])) {
                nextTick(() => {
                    this.create(input[key], null, `${prefix}${key}.`);
                })
            }
        });

        (input as any).__proto__.push = function (value, keyToAdd) {
            this[keyToAdd] = value;
            const length = getObjectLength(this);
            onChange(`${prefix}push`, {
                value: value,
                key: keyToAdd,
                length: length
            }, null);
            return length;
        };
        // splice
        (input as any).__proto__.splice = function (index, noOfItemToDelete) {
            onChange(`${prefix}splice`, [index, noOfItemToDelete], null);
        };
        //set
        (input as any).__proto__.update = function (prop, value) {
            this[prop] = value;
            onChange(`${prefix}update`, [prop, value], null);
        };
    }
}


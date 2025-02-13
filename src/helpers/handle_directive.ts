import { Component } from "../abstracts";
import { forOwn, merge, nextTick } from "../utils";
import { IDirectiveBinding, IDirective } from "../interface";
import { genericDirective } from "../generics";
import { LIFECYCLE_EVENT } from "../enums";

export function handleDirective(this: Component, element, dir, isComponent) {
    if (!dir) return;
    forOwn(dir, (name, compiledDir) => {
        const storedDirective = this['__directive__'][name] || this['__app__']['_directives'][name];
        if (storedDirective) {
            const binding: IDirectiveBinding = compiledDir;
            binding.isComponent = isComponent;

            const directive: IDirective = merge(genericDirective,
                storedDirective.call(this, element, binding));
            let eventCbs = [];
            nextTick(() => {

                const onDestroyed = () => {
                    directive.destroyed();
                    if (!isComponent) {
                        element.removeEventListener(LIFECYCLE_EVENT.Destroy, onDestroyed);
                    }
                    compiledDir.props.forEach((prop, index) => {
                        this.unwatch(prop, eventCbs[index]);
                    });
                    element = null;
                    eventCbs = null;
                };
                if (isComponent) {
                    (element as Component).on(LIFECYCLE_EVENT.Destroy, onDestroyed);
                }
                else {
                    element.addEventListener(LIFECYCLE_EVENT.Destroy, onDestroyed);
                }
                compiledDir.props.forEach((prop, index) => {
                    const ev = (newValue, oldValue) => {
                        if (oldValue === newValue) return;
                        binding.value[index] = newValue;
                        directive.valueUpdated();
                    };
                    this.watch(prop, ev);
                    eventCbs.push(ev);
                });
                directive.inserted();
            });
        }
    });
}
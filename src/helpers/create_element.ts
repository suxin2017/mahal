import { createCommentNode } from "./create_coment_node";
import { HTML_TAG, ERROR_TYPE, LIFECYCLE_EVENT } from "../enums";
import { defaultSlotName, EL_REPLACED, FALSE, TRUE } from "../constant";
import { handleAttribute } from "./handle_attribute";
import { isKeyExist, initComponent, executeRender, replaceEl, getAttribute, setAttribute, createComponent, promiseResolve, ILazyComponentPayload } from "../utils";
import { executeEvents } from "./execute_events";
import { handleDirective } from "./handle_directive";
import { Component } from "../abstracts";
import { handleInPlace } from "./handle_in_place";
import { emitError } from "./emit_error";
import { Logger } from "./logger";


function createNativeComponent(tag: string, htmlChilds: HTMLElement[], option): HTMLElement {
    switch (tag) {
        case "slot":
        case "target":
            if (!option.attr.name) {
                option.attr.name = {
                    v: defaultSlotName
                };
            }
    }

    const element = document.createElement(tag) as HTMLElement;
    htmlChilds.forEach((item) => {
        element.appendChild(item);
    });

    handleAttribute.call(this, element, option.attr, FALSE);

    if (option.on) {
        let evListener = {};
        const events = option.on;
        for (const eventName in events) {
            const ev = events[eventName];
            const methods = [];
            ev.modifiers.forEach(item => {
                switch (item) {
                    case 'prevent':
                        methods.push((e) => {
                            e.preventDefault();
                            return e;
                        }); break;
                    case 'stop':
                        methods.push((e) => {
                            e.stopPropagation();
                            return e;
                        }); break;
                }
            });
            ev.handlers.forEach(item => {
                if (typeof item === 'function') {
                    methods.push(item);
                }
                else {
                    new Logger(ERROR_TYPE.InvalidEventHandler, {
                        ev: eventName,
                    }).throwPlain();
                }
            });
            // if (eventName === "input" && !ev.isNative) {
            //     methods.unshift((e) => {
            //         return e.target.value;
            //     });
            // }
            evListener[eventName] = (e) => {
                executeEvents.call(this, methods, e);
            };

            (element as HTMLDivElement).addEventListener(
                eventName, evListener[eventName],
                {
                    capture: isKeyExist(ev.option, 'capture'),
                    once: isKeyExist(ev.option, 'once'),
                    passive: isKeyExist(ev.option, 'passive'),
                }
            );
        }

        const onElDestroyed = () => {
            element.removeEventListener(LIFECYCLE_EVENT.Destroy, onElDestroyed);
            for (const ev in evListener) {
                element.removeEventListener(ev, evListener[ev]);
            }
            evListener = {};
        };
        element.addEventListener(LIFECYCLE_EVENT.Destroy, onElDestroyed);
    }

    handleDirective.call(this, element, option.dir, FALSE);
    return element;
}



export function createElement(this: Component, tag: string, childs: HTMLElement[], option): HTMLElement | Comment {
    if (tag == null) {
        return createCommentNode();
    }
    if (!option.attr) {
        option.attr = {};
    }

    if (HTML_TAG[tag]) {
        return createNativeComponent.call(this, tag, childs, option);
    }
    const savedComponent = this.children[tag] || this['__app__']['_components'][tag];
    if (savedComponent) {
        const loadComponent = (componentClass) => {
            if (componentClass instanceof Promise) {
                return componentClass.then(comp => {
                    return comp.default;
                });
                // return createCommentNode();
            }
            else if (componentClass.isLazy) {
                return loadComponent(
                    (componentClass as ILazyComponentPayload).component()
                );
                // return createCommentNode();
            }
            return componentClass;
        };
        const renderComponent = (comp) => {
            const component: Component = createComponent(comp, this['__app__']);
            const htmlAttributes = initComponent.call(this, component as any, option);
            executeRender(component, childs);
            let element = component.element;
            let targetSlot = component.find(`slot[name='default']`) || (element.tagName.match(/slot/i) ? element : null);
            if (targetSlot) {
                childs.forEach(item => {
                    if (item.tagName === "TARGET") {
                        const namedSlot = component.find(`slot[name='${item.getAttribute("name")}']`);
                        if (namedSlot) {
                            targetSlot = namedSlot;
                        }
                    }
                    const targetSlotParent = targetSlot.parentElement;
                    if (targetSlotParent) {
                        // nodeType -3 : TextNode
                        if (item.nodeType === 3) {
                            targetSlotParent.insertBefore(item, targetSlot.nextSibling);
                        }
                        else {
                            item.childNodes.forEach(child => {
                                targetSlotParent.insertBefore(child, targetSlot.nextSibling);
                            });
                        }
                        targetSlotParent.removeChild(targetSlot);
                    }
                    else {
                        element = component.element = item;
                    }
                });
            }

            (htmlAttributes || []).forEach(item => {
                switch (item.key) {
                    case 'class':
                        item.value = (getAttribute(element, item.key) || '') + ' ' + item.value;
                        break;
                    case 'style':
                        item.value = (getAttribute(element, item.key) || '') + item.value;
                }
                setAttribute(element, item.key, item.value);
            });
            return element;
        };
        const compPromise = loadComponent(savedComponent);
        if (compPromise instanceof Promise) {
            const el = createCommentNode();
            compPromise.then(comp => {
                const newEl = renderComponent(comp);
                el[EL_REPLACED] = newEl;
                replaceEl(
                    el as any,
                    newEl,
                );
            }).catch((err) => {
                emitError.call(this, err, TRUE);
            });
            return el;
        }
        return renderComponent(compPromise);
    }
    else if (tag === "in-place") {
        return handleInPlace.call(this, childs, option);
    }
    else {
        new Logger(ERROR_TYPE.InvalidComponent, {
            tag: tag
        }).throwPlain();
    }
}

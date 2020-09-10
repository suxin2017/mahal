import { ParserUtil } from "../parser_util";
import { HTML_TAG, ERROR_TYPE, LIFECYCLE_EVENT } from "../enums";
import { setAndReact, Observer } from "../helpers";
import { IPropOption, ITajStore } from "../interface";
import { globalFilters, MutationObserver } from "../constant";
import { isArray, isObject, isPrimitive, nextTick, LogHelper, isNull } from "../utils";

let uniqueCounter = 0

export abstract class Component {
    children: { [key: string]: typeof Component }
    element: HTMLElement;
    template: string;
    $store: ITajStore;

    constructor() {
        nextTick(() => {
            this.on(LIFECYCLE_EVENT.Rendered, this.onRendered.bind(this));
            this.on(LIFECYCLE_EVENT.Created, this.onCreated.bind(this));
            this.on(LIFECYCLE_EVENT.Destroyed, this.onDestroyed.bind(this));

            this.attachGetterSetter_();
            this.emit(LIFECYCLE_EVENT.Created);
        })
        if (this.children == null) {
            this.children = {};
        }
    }

    destroy() {
        this.element.parentNode.removeChild(this.element);
    }

    addProp(name: string, option: IPropOption | any) {
        if ((this as any).prototype.props_ == null) {
            (this as any).prototype.props_ = {};
        }
        (this as any).prototype.props_ = option;
    }

    watch(propName: string, cb: (newValue, oldValue) => void) {
        if (this.watchList_[propName] == null) {
            this.watchList_[propName] = [];
        }
        this.watchList_[propName].push(cb);
    }

    get unique() {
        return ++uniqueCounter;
    }

    set(target, prop, valueToSet) {
        setAndReact(target, prop, valueToSet);
    }

    render: () => void;

    createTextNode(value, propDependency) {
        const el = document.createTextNode(value);
        if (propDependency) {
            this.storeDependency_(propDependency, el);
        }
        return el;
    }

    createCommentNode() {
        return document.createComment("");
    }

    private updateDOM_(key: string) {

        for (const prop in this.dependency_) {
            if (prop === key) {
                const depItems = this.dependency_[prop];
                depItems.forEach(item => {
                    switch (item.nodeType) {
                        // Text Node
                        case 3:
                            item.nodeValue = this.resolve_(key); break;
                        // Input node 
                        case 1:
                            (item as HTMLInputElement).value = this.resolve_(key)
                            break;
                        default:
                            if (item.ifExp) {
                                const el = item.method();
                                (item.el as HTMLElement).parentNode.replaceChild(
                                    el, item.el
                                )
                                item.el = el;
                            }
                    }
                });
                return;
            }
        }
    }

    private storeIfExp_(method: Function, keys: string[], id: string) {
        const el = method();
        const dep = {
            el: el,
            method: method,
            id: id,
            ifExp: true
        }
        keys.forEach(item => {
            this.storeDependency_(item, dep);
        })
        return el;
    }

    private dependency_: { [key: string]: any[] } = {};

    private attachGetterSetter_() {
        new Observer(this).create((key, oldValue, newValue) => {
            if (this.watchList_[key]) {
                this.watchList_[key].forEach(cb => {
                    cb(newValue, oldValue);
                })
            }
            this.updateDOM_(key);
        }, (key) => {
            if (isArray(this[key])) {
                new Observer(this[key]).createForArray((arrayProp, params) => {
                    this.onObjModified_(key, arrayProp, params);
                })
            }
            else if (isObject(this[key])) {
                new Observer(this[key]).create((objectProp, oldValue, newValue) => {
                    this.onObjModified_(key, objectProp, oldValue);
                })
            }
        }, this.reactives_ || []);
    }

    private onObjModified_(key: string, prop, params) {
        if (this.dependency_[key]) {
            this.dependency_[key].filter(q => q.forExp === true).forEach(item => {
                const parent = (item.ref as Comment).parentNode as HTMLElement;
                const indexOfRef = Array.prototype.indexOf.call(parent.childNodes, item.ref);
                switch (prop) {
                    case 'push':
                        var newElement = item.method(params.value, params.key);
                        (parent as HTMLElement).insertBefore(newElement, parent.childNodes[indexOfRef + params.length]);
                        break;
                    case 'splice':
                        for (let i = 1; i <= params[1]; i++) {
                            parent.removeChild(parent.childNodes[indexOfRef + params[0] + i]);
                        }
                        var newElement = item.method(params[2], params[0]);
                        (parent as HTMLElement).insertBefore(newElement, parent.childNodes[indexOfRef + 1 + params[0]]);
                        break;
                    default:
                        // if(isObject())
                        const resolvedValue = this.resolve_(key)
                        const index = Object.keys(resolvedValue).findIndex(q => q === prop);
                        if (index >= 0) {
                            var newElement = item.method(resolvedValue[prop], prop);
                            parent.replaceChild(newElement, parent.childNodes[indexOfRef + 1 + index]);
                        }
                    // values.forEach(item => {
                    //     const newElement = item.method(newValue, prop);
                    //     // (item.lastEl as HTMLElement).parentNode.insertBefore(newElement, item.lastEl.nextSibling);
                    //     // item.lastEl = newElement;
                    //     const parent = (item.ref as Comment).parentNode;
                    //     if (prop === "0") {
                    //         (parent as HTMLElement).insertBefore(newElement, item.ref);
                    //     }
                    //     else {
                    //         const indexOfRef = Array.prototype.indexOf.call(parent.childNodes, item.ref);

                    //         if (this[key][prop]) {
                    //             // (item.parent as HTMLElement).insertBefore(newElement, item.parent.children[prop]);
                    //             parent.replaceChild(newElement, parent.childNodes[indexOfRef + Number(prop)]);
                    //         }
                    //         else {
                    //             // (item.parent as HTMLElement).appendChild(newElement);
                    //             (parent as HTMLElement).insertBefore(newElement, parent.childNodes[indexOfRef + 1 + Number(prop)]);
                    //         }
                    //     }

                    // });
                    // break;
                }
            });
            // console.log("value", values);
            // return;
        }
    }

    private storeForExp_(key, method: Function, id: string) {
        const cmNode = this.createCommentNode();
        const els = [cmNode];
        const resolvedValue = this.resolve_(key);

        if (process.env.NODE_ENV !== 'production') {
            if (isPrimitive(resolvedValue) || isNull(resolvedValue)) {
                throw new LogHelper(ERROR_TYPE.ForOnPrimitiveOrNull, key).getPlain();
            }
        }

        if (isArray(resolvedValue)) {
            resolvedValue.map((item, i) => {
                els.push(method(item, i));
            });
        }
        else if (isObject(resolvedValue)) {
            for (let key in resolvedValue) {
                els.push(method(resolvedValue[key], key));
            }
        }

        nextTick(() => {
            this.storeDependency_(key, {
                forExp: true,
                method: method,
                ref: cmNode,
                id: id
            });
            new MutationObserver((mutationsList, observer) => {
                if (document.body.contains(cmNode) === false) {
                    observer.disconnect();
                    const depIndex = this.dependency_[key].findIndex(q => q.id === id);
                    this.dependency_[key].splice(depIndex, 1);
                }
            }).observe(this.element, { childList: true, subtree: true });
        });
        return els;
    }

    private resolve_(path) {
        var properties = Array.isArray(path) ? path : path.split(".")
        return properties.reduce((prev, curr) => prev && prev[curr], this)
    }

    private storeDependency_(key: string, value) {
        // if (this[key] == null) {
        //     return;
        // }
        if (this.dependency_[key] == null) {
            this.dependency_[key] = [value];
        }
        else if (this.dependency_[key].findIndex(q => q.id === value.id) < 0) {
            this.dependency_[key].push(value);
        }
    }

    private events_: {
        [key: string]: Function[]
    } = {};

    on(event: string, cb: Function) {
        if (this.events_[event] == null) {
            this.events_[event] = [];
        }
        this.events_[event].push(cb);
        return this;
    }

    off(event: string, cb: Function) {
        if (this.events_[event]) {
            if (cb) {
                const index = this.events_[event].indexOf(cb);
                this.events_[event].splice(index, 1);
            }
            else {
                this.events_[event] = [];
            }
        }
    }

    emit(event: string, data?: any) {
        if (this.events_[event]) {
            this.events_[event].forEach(cb => {
                cb(data);
            })
        }
    }

    createElement(tag, childs: HTMLElement[], option) {
        let element;
        if (HTML_TAG[tag]) {
            element = document.createElement(tag) as HTMLElement;
            childs.forEach((item) => {
                element.appendChild(item);
            });

            if (option.html) {
                (element as HTMLElement).innerHTML = option.html;
            }

            if (option.attr) {
                const attr = option.attr;
                for (const key in attr) {
                    element.setAttribute(key, attr[key].v);
                }
            }

            if (option.on) {
                const events = option.on;
                for (const eventName in events) {
                    if (events[eventName]) {
                        element['on' + eventName] = events[eventName].bind(this);
                    }
                    else {
                        throw `Invalid event handler for event ${eventName}, Handler does not exist`;
                    }
                }
            }
        }
        else if (this.children[tag]) {
            const component: Component = new (this.children[tag] as any)();
            const htmlAttributes = this.initComponent_(component as any, option);
            element = component.element = component.executeRender_();
            htmlAttributes.forEach(item => {
                element.setAttribute(item.key, item.value);
            })
        }
        else {
            throw `Invalid Component ${tag}. If you have created a component, Please register your component.`;
        }


        if (option.dep) {
            option.dep.forEach(item => {
                this.storeDependency_(item, element);
            });
        }
        return element;

    }

    find(selector: string) {
        return this.element.querySelector(selector);
    }

    findAll(selector: string) {
        return this.element.querySelectorAll(selector);
    }

    onRendered() {
    }

    onCreated(cb) {
    }

    onDestroyed(cb) {
    }

    filter(name: string, value) {
        if (globalFilters[name]) {
            return globalFilters[name](value);
        }
        else if (this.filters_[name]) {
            return this.filters_[name](value);
        }
        throw `Can not find filter ${name}`;
    }


    private initComponent_(component: this, option) {
        if (component._$storeGetters) {
            // can not make it async because if item is array then it will break
            // because at that time value will be undefined
            // so set it before rendering
            component._$storeGetters.forEach(item => {
                component[item.prop] = component.$store.state[item.state];
                const cb = (newValue) => {
                    component[item.prop] = newValue;
                    component.updateDOM_(item.prop);
                }
                component.$store.watch(item.state, cb);
                component._$storeWatchCb.push({
                    key: item.state,
                    cb
                });
            });
        }

        const htmlAttributes = [];
        if (option.attr) {
            const attr = option.attr;
            for (const key in attr) {
                const value = attr[key];
                if (component.props_[key]) {
                    component[key] = value.v;
                    this.watch(value.k, (newValue) => {
                        component[key] = newValue;
                        component.updateDOM_(key);
                    });
                }
                else {
                    htmlAttributes.push({
                        key,
                        value: value.v
                    })
                }
            }
        }
        if (option.on) {
            const events = option.on;
            for (const eventName in events) {
                if (events[eventName]) {
                    component.on(eventName, events[eventName].bind(this));
                }
                else {
                    throw `Invalid event handler for event ${eventName}, Handler does not exist`;
                }
            }
        }
        return htmlAttributes;
    }

    private clearAll_() {
        this._$storeWatchCb.forEach(item => {
            this.$store.unwatch(item.key, item.cb)
        });
        this.events_ = {};
        this.watchList_ = {};
        this.emit(LIFECYCLE_EVENT.Destroyed);
    }

    private executeRender_() {
        const renderFn = this.render || ParserUtil.createRenderer(this.template);
        // console.log("renderer", renderFn);
        this.element = renderFn.call(this);
        nextTick(() => {
            new MutationObserver((mutationsList, observer) => {
                if (document.body.contains(this.element) === false) {
                    observer.disconnect();
                    this.clearAll_();
                }
            }).observe(document.body, { childList: true, subtree: true });
            if ((this as any).$store) {
                for (let key in this.dependency_) {
                    if (key.indexOf("$store.state") >= 0) {
                        const cb = () => {
                            this.updateDOM_(key);
                        };
                        key = key.replace("$store.state.", '');
                        (this as any).$store.watch(key, cb);
                        this._$storeWatchCb.push({
                            key, cb
                        });
                    }
                }
            }
            this.emit(LIFECYCLE_EVENT.Rendered);
        })
        return this.element;
    }


    private filters_;
    private props_;
    private reactives_;

    private watchList_: {
        [key: string]: Array<(newValue, oldValue) => void>
    } = {};

    private _$storeWatchCb: { key: string, cb: Function }[] = [];

    private _$storeGetters: { prop: string, state: string }[];

}
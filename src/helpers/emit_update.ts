import { Component } from "../abstracts";
import { LIFECYCLE_EVENT } from "../enums";

export const emitUpdate = (comp: Component) => {
    if (comp.isMounted) {
        comp['_timer'].debounce(() => {
            comp.emit(LIFECYCLE_EVENT.Update);
        });
    }
};
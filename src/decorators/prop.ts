import { IPropOption } from "../interface";
import { DATA_TYPE } from "../enums";

// tslint:disable-next-line
export const Prop = (options?: IPropOption | any) => {
    return (target, key: string) => {
        if (!target.__props__) {
            target.__props__ = {};
        }
        if (typeof options === DATA_TYPE.Function) {
            const name = options.name;
            if (DATA_TYPE[name]) {
                options = name.toLowerCase();
            }
        }
        if (options && !options.type) {
            options = {
                type: options
            };
        }
        target.__props__[key] = options || {};
    };
};
export const isPrimitive = (value) => {
    switch (typeof value) {
        case 'undefined':
        case 'object':
            return false;
    }
    return true;
};
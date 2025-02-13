export const setAttribute =
    (element: HTMLElement, key: string, value: string) => {
        // if (element.nodeType === 8) return;
        if (element.nodeType === 1 && key === "value") {
            return (element as HTMLInputElement).value = value;
        }
        return element.setAttribute(key, value);
    };
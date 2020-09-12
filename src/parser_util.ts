import * as parser from '../build/parser';
import { LogHelper } from './utils/log_helper';
import { ERROR_TYPE, HTML_TAG } from './enums';
import { ICompiledView, IIfExpModified } from './interface';
var beautify = require('js-beautify');

const stringRegex = new RegExp(/["\']/g)
let uniqueCount = 0;

const unique = () => {
    return ++uniqueCount;
}
export class ParserUtil {

    static addCtxToExpression(exp, cb?) {
        const keys = [];
        const modifiedExpression = exp.split(" ").map((item: string) => {
            switch (item) {
                case '&&':
                case '||':
                case 'true':
                case '':
                case 'false': return item;
                default:
                    const key = item.replace(/([=][=]|[!][=]).*/, '');
                    if (stringRegex.test(key) === false) {
                        keys.push(key);
                    }

                    return stringRegex.test(item) === true ?
                        item :
                        "ctx." + item;
            }
        }).join(" ");
        if (cb) {
            cb(keys);
        }
        return modifiedExpression;
    }

    static parseview(viewCode: string) {
        try {
            // viewCode = viewCode.replace(new RegExp('\n', 'g'), '').trim();
            viewCode = viewCode.trim();
            return parser.parse(viewCode, {
                createFnFromStringExpression: ParserUtil.addCtxToExpression
            }) as ICompiledView;
        }
        catch (ex) {
            const location = ex.location;
            const css = `background: #222; color: #bada55`;
            const lines = viewCode.split("\n");
            // console.log(`%c${viewCode.substring(0, location.start.offset)}%c${viewCode.substring(location.start.offset, location.end.offset + 1)}%c${viewCode.substring(location.end.offset + 1)}`,
            //     css, css + ';color:red', css);
            // do not remove this
            console.log("%c" + lines.slice(0, location.start.line - 1).join("\n") +
                "%c" + lines.slice(location.start.line - 1, location.end.line).join("\n") +
                "%c" + lines.slice(location.end.line).join("\n")
                , css, css + ';color:red', css);
            const err = new LogHelper(ERROR_TYPE.SynTaxError, ex.message).getPlain();
            throw err;
        }
    }

    static createRenderer(template: string) {
        const compiledParent = ParserUtil.parseview(template);
        // console.log("compiled", compiledParent);
        if (compiledParent.view) {
            if (compiledParent.view.forExp) {
                console.error(`Invalid template ${template}`);
                throw new LogHelper(ERROR_TYPE.ForExpAsRoot).get();
            }
        }
        let parentStr = `const ctx= this;`;
        const createJsEqFromCompiled = (compiled: ICompiledView) => {
            let str = "";
            if (compiled.view) {
                const dep = [];
                const handleTag = () => {
                    let tagHtml = `ce('${compiled.view.tag}',`
                    if (compiled.child) {
                        let ifModifiedExpression: IIfExpModified;
                        let indexOfIfCond;
                        const indexToRemove = [];
                        const onIfCondEnd = (last: number) => {
                            compiled.child[indexOfIfCond].view.ifExpModified = ifModifiedExpression;
                            ifModifiedExpression = null;
                            // console.log("if cond modified", indexOfIfCond, compiled.child[indexOfIfCond]);
                            for (let i = indexOfIfCond + 1; i < last; i++) {
                                indexToRemove.push(i);
                            }
                        }
                        compiled.child.forEach((child, index) => {
                            if (!(child.view && child.view.ifExp)) {
                                return;
                            }
                            const ifExp = child.view.ifExp;
                            if (ifExp.ifCond) {
                                ifModifiedExpression = {
                                    ifExp: ifExp.ifCond,
                                    ifElseList: []
                                } as IIfExpModified;
                                indexOfIfCond = index;
                            }
                            else if (ifExp.elseIfCond) {
                                ifModifiedExpression.ifElseList.push(child);
                            }
                            else if (ifExp.else) {
                                ifModifiedExpression.else = child;
                                onIfCondEnd(index + 1);
                            }
                            else {
                                onIfCondEnd(index);
                            }
                        });

                        // there was no end found and loop has ended
                        if (ifModifiedExpression) {
                            onIfCondEnd(compiled.child.length);
                        }
                        // console.log("indexOfIfCond", indexToRemove);
                        compiled.child = compiled.child.filter((child, index) => {
                            return indexToRemove.indexOf(index) < 0
                        })

                        var child = "["
                        compiled.child.forEach((item, index) => {
                            const childCompiled = createJsEqFromCompiled(item);
                            if (childCompiled && childCompiled.trim().length > 0) {
                                child += `${childCompiled},`;
                            }
                        });
                        if (child[child.length - 1] === ",") {
                            child = child.substr(0, child.length - 1);
                        }
                        child += "]";
                        tagHtml += child;
                    }
                    else {
                        tagHtml += "[]";
                    }
                    return tagHtml;
                }

                const handleOption = () => {
                    let optionStr = ",{";

                    // handle event
                    const eventLength = compiled.view.events.length;
                    if (eventLength > 0) {
                        let eventStr = "";
                        // const identifierRegex = /([a-zA-Z]+)/g
                        // const identifierRegex = /\b(?!(?:false\b))([\w]+)/g
                        const identifierRegex = /\b(?!(?:false|true\b))([a-zA-Z]+)/g
                        compiled.view.events.forEach((ev, index) => {
                            eventStr += `${ev.name}:${ev.handler.replace(identifierRegex, 'ctx.$1')}`;
                            if (index + 1 < eventLength) {
                                eventStr += ","
                            }
                        });
                        optionStr += `on:{${eventStr}}`;
                    }
                    else if (compiled.view.model) {
                        optionStr += `on:{input:(e)=>{
                            ctx.${compiled.view.model}= e.target.value;
                        }}`;
                        compiled.view.attr.push({
                            isBind: true,
                            key: 'value',
                            value: compiled.view.model,
                        })
                        dep.push(compiled.view.model);
                    }


                    if (compiled.view.html) {
                        optionStr += `${optionStr.length > 2 ? "," : ''} html:ctx.${compiled.view.html}`;
                    }

                    // handle attributes
                    const attr = compiled.view.attr;
                    const attrLength = attr.length;
                    if (attrLength > 0) {
                        let attrString = '';
                        attr.forEach((item, index) => {
                            if (item.isBind) {
                                attrString += `${item.key}:{v:ctx.${item.value},k:'${item.value}'}`;
                            }
                            else {
                                attrString += `${item.key}:{v:'${item.value}'}`;
                            }
                            if (index + 1 < attrLength) {
                                attrString += ","
                            }
                        });

                        optionStr += `${optionStr.length > 2 ? "," : ''} attr:{${attrString}}`;
                    }

                    // handle dep
                    const depLength = dep.length;
                    if (depLength > 0) {
                        let depString = "["
                        dep.forEach((item, index) => {
                            depString += `'${item}'`;
                            if (index + 1 < depLength) {
                                depString += ","
                            }
                        });
                        depString += "]"
                        optionStr += `${optionStr.length > 2 ? "," : ''} dep:${depString}`;
                    }

                    optionStr += "})";
                    return optionStr;
                }

                const handleFor = (value: string) => {
                    let forExp = compiled.view.forExp;
                    let key;
                    forExp.value = ParserUtil.addCtxToExpression(forExp.value, (param) => {
                        key = param[0];
                    });
                    const getRegex = (subStr) => {
                        return new RegExp(subStr, 'g');
                    }
                    return `...hForE('${key}',(${forExp.key},${forExp.index})=>{
                                return ${
                        value.replace(getRegex(`ctx.${forExp.key}`), forExp.key).
                            replace(getRegex(`ctx.${forExp.index}`), forExp.index)
                        }
                            },${unique()})
                    `
                    //return forStr;
                }
                const ifModified = compiled.view.ifExpModified;
                if (ifModified && ifModified.ifExp) {
                    let keys = "["
                    const ifCond = ParserUtil.addCtxToExpression(ifModified.ifExp, (param) => {
                        param.forEach((key) => {
                            keys += `'${key}',`
                        });
                    });
                    str += `he(()=>{return ${ifCond} ? ${handleTag() + handleOption()}`

                    ifModified.ifElseList.forEach(item => {
                        const ifElseCond = ParserUtil.addCtxToExpression(item.view.ifExp.elseIfCond, (param) => {
                            param.forEach((key) => {
                                keys += `'${key}',`
                            });
                        });
                        str += `:${ifElseCond} ? ${createJsEqFromCompiled(item)} `
                    });

                    keys += "]"
                    let elseString;
                    if (ifModified.else) {
                        elseString = createJsEqFromCompiled(ifModified.else);
                    }
                    else {
                        elseString = `ce()`;
                    }
                    // str += (() => {
                    //     let temp = "";
                    //     for (let i = 0, len = ifModified.ifElseList.length; i < len; i++) {
                    //         temp += "})"
                    //     }
                    //     return temp;
                    // })();
                    str += `:${elseString} },${keys},${unique()})`
                }
                else {
                    if (compiled.view.forExp) {
                        str += handleFor(handleTag() + handleOption())
                    }
                    else {
                        str += handleTag() + handleOption()
                    }
                }
            }
            else if (compiled.mustacheExp) {

                let method = `()=>{return ct(`;
                let brackets = "";
                compiled.filters.forEach(item => {
                    method += `f('${item}',`
                    brackets += ")"
                });
                let keys;
                method += `${ParserUtil.addCtxToExpression(compiled.mustacheExp, (param) => {
                    keys = JSON.stringify(param);
                })} ${brackets} )}`;
                str += `he(${method}, ${keys},${unique()})`
            }
            else if ((compiled as any).trim().length > 0) {
                str += `ct('${compiled}')`;
            }
            return str;
        }
        parentStr += `return ${createJsEqFromCompiled(compiledParent)}`;
        parentStr = beautify(parentStr, { indent_size: 4, space_in_empty_paren: true })
        console.log("parentstr", parentStr);
        return new Function('ce', 'ct', 'f', 'he', 'hForE', parentStr);
    }
}
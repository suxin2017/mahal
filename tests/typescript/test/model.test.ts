import ModelComponent from "../src/components/model";
import { app } from "../src/index";
import { nextTick } from "mahal";
import { expect } from "chai";

describe('MODEL', function () {

    let component;

    before(async function () {
        component = await (app as any).initiate(ModelComponent);
    });

    it("from component to element", function (done) {
        const input = component.find('input');
        expect(input.value).equal('undefined');
        component.text = "ujjwal";
        nextTick(() => {
            expect(input.value).equal('ujjwal');
            done();
        })
    });

    it("from element to component", function () {
        const input = component.find('input');
        input.setValue("random");
        expect(component.text).equal('random');
    });

});


import { app } from "../src/index";
import { nextTick, Template, Component, Prop, Children, Reactive } from "mahal";
import { expect } from "chai";
import Btn from "../src/components/btn";

@Children({
    Btn
})
@Template(`
<div>
    <in-place :of="name" #if(flag1 && flag2) label="as"/>
</div>
`)
class Temp extends Component {
    content = "Button"

    @Reactive
    flag1 = false;

    @Reactive
    flag2 = false;

    @Reactive
    name = "Btn"
}

describe('InPlace if toggle', function () {

    let component;

    const testNotExist = () => {
        const btn = component.find('button.btn');
        expect(btn).to.equal(null);
    }

    const testExist = (done) => {
        const btn = component.find('.btn');
        expect(btn).to.not.equal(null);
        done();
    }

    it("initiate btn", async function () {
        component = await (app as any).mount(Temp);
        testNotExist();
    });

    for (let i = 0; i < 3; i++) {
        it(`turn on - ${i}`, function (done) {
            setTimeout(async () => {
                component.flag1 = true;
                component.flag2 = true;
                await component.waitFor("update");
                testExist(done);
            }, 10)
        });

        it(`turn off - ${i}`, function (done) {
            setTimeout(async () => {
                component.flag1 = false;
                component.flag2 = false;
                await component.waitFor("update");
                testNotExist();
                done();
            }, 10)
        });
    }

    it("check watchlist length", function () {
        expect(component.watchList_["name"]).length(1);
        expect(window['error']).to.equal(undefined);
    });
});



import * as assert from "assert";
import * as fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsdom = require("jsdom");
const {JSDOM,} = jsdom;

function makeDom() {
    const buffer = fs.readFileSync("./dist/index.html");
    const dom = new JSDOM(buffer, {runScripts: "dangerously",});
    dom.virtualConsole.sendTo(console);
    console.log("DOM started");
    return dom;
}

describe('sample test', () => {
    it('Displays the welcome message', () => {
        const dom = makeDom();
        const body = dom.window.document.body;
        assert.ok(body.querySelector("div#welcome-message"));
    });
    // it('Can click new sheet button', (done) => {
    //     const dom = makeDom();
    //     const body = dom.window.document.body;
    //     body.querySelector("a#new-sheet-button").click();
    //     setTimeout(() => {
    //         assert.ok(body.querySelector("form#new-sheet-form"));
    //         done();
    //     }, 10_000);
    // }).timeout(20_000);
    // it('Can load an imported sheet', (done) => {
    //     const dom = makeDom();
    //     dom.window.location.hash = "/viewsheet/{\"partyBonus\"%3A0%2C\"sets\"%3A[{\"name\"%3A\"6.5 TOP BiS - Crit%2FDet Relic\"%2C\"items\"%3A{\"Wrist\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33933}]%2C\"id\"%3A38074}%2C\"RingRight\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38154}%2C\"Legs\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38054}%2C\"Head\"%3A{\"materia\"%3A[{\"id\"%3A33942}%2C{\"id\"%3A33933}]%2C\"id\"%3A38051}%2C\"RingLeft\"%3A{\"materia\"%3A[{\"id\"%3A33931}]%2C\"id\"%3A40818}%2C\"Neck\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33931}]%2C\"id\"%3A38069}%2C\"Body\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38127}%2C\"Hand\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33931}]%2C\"id\"%3A40792}%2C\"Ears\"%3A{\"materia\"%3A[{\"id\"%3A33931}]%2C\"id\"%3A40803}%2C\"Weapon\"%3A{\"relicStats\"%3A{\"dhit\"%3A0%2C\"crit\"%3A293%2C\"spellspeed\"%3A72%2C\"determination\"%3A293%2C\"piety\"%3A0}%2C\"materia\"%3A[]%2C\"id\"%3A39937}%2C\"Feet\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38130}}%2C\"food\"%3A39876}%2C{\"name\"%3A\"6.5 TOP BiS - Crit%2FSPS Relic\"%2C\"items\"%3A{\"Wrist\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38074}%2C\"RingRight\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38154}%2C\"Legs\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38054}%2C\"Head\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38051}%2C\"RingLeft\"%3A{\"materia\"%3A[{\"id\"%3A33931}]%2C\"id\"%3A40818}%2C\"Neck\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33931}]%2C\"id\"%3A38069}%2C\"Body\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33933}]%2C\"id\"%3A38127}%2C\"Hand\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33931}]%2C\"id\"%3A40792}%2C\"Ears\"%3A{\"materia\"%3A[{\"id\"%3A33931}]%2C\"id\"%3A40803}%2C\"Weapon\"%3A{\"relicStats\"%3A{\"dhit\"%3A0%2C\"crit\"%3A293%2C\"spellspeed\"%3A293%2C\"determination\"%3A72%2C\"piety\"%3A0}%2C\"materia\"%3A[]%2C\"id\"%3A39937}%2C\"Feet\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38130}}%2C\"food\"%3A39872}%2C{\"name\"%3A\"6.4 2.42 Tome Ring\"%2C\"description\"%3A\"Less piety than the other options%2C but provides the highest possible damage without sacrificing any vitality. \\nIf you wish to squeeze out very slightly more damage%2C you may use a crafted ring instead%2C but you will have very low piety and less HP.\"%2C\"items\"%3A{\"Wrist\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33933}]%2C\"id\"%3A38074}%2C\"RingRight\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33942}]%2C\"id\"%3A38079}%2C\"Legs\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38054}%2C\"Head\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38051}%2C\"RingLeft\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33931}]%2C\"id\"%3A38154}%2C\"Neck\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33931}]%2C\"id\"%3A38069}%2C\"Body\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38127}%2C\"Hand\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33932}]%2C\"id\"%3A38053}%2C\"Ears\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33932}]%2C\"id\"%3A38139}%2C\"Weapon\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38098}%2C\"Feet\"%3A{\"materia\"%3A[{\"id\"%3A33931}%2C{\"id\"%3A33931}]%2C\"id\"%3A38130}}%2C\"food\"%3A38264}%2C{\"name\"%3A\"6.4 2.47 Medium Pi No Relic\"%2C\"description\"%3A\"Very good amount of piety for prog and a slow GCD to help conserve MP. \\n\\nTerrible GCD for alignment%2C but ultimates have so much downtime that it's usually not an issue. Feel free to meld up closer to 2.40 if it bothers you. \"%2C\"items\"%3A{\"Wrist\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33931}]%2C\"id\"%3A38074}%2C\"RingRight\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33933}]%2C\"id\"%3A38079}%2C\"Legs\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38054}%2C\"Head\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33931}]%2C\"id\"%3A38051}%2C\"RingLeft\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33931}]%2C\"id\"%3A38154}%2C\"Neck\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33933}]%2C\"id\"%3A38069}%2C\"Body\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38127}%2C\"Hand\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38128}%2C\"Ears\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38064}%2C\"Weapon\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38098}%2C\"Feet\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33931}]%2C\"id\"%3A38130}}%2C\"food\"%3A38264}%2C{\"name\"%3A\"6.4 2.50 Hi Pi No Relic\"%2C\"description\"%3A\"Very safe MP set for those who want to go in without worrying about mana. Likely much more mana than is actually required%2C as the fight does not allow for recovery from a death in many phases.\"%2C\"items\"%3A{\"Wrist\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33931}]%2C\"id\"%3A38074}%2C\"RingRight\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33933}]%2C\"id\"%3A38079}%2C\"Legs\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38054}%2C\"Head\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33931}]%2C\"id\"%3A38051}%2C\"RingLeft\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33931}]%2C\"id\"%3A38154}%2C\"Neck\"%3A{\"materia\"%3A[{\"id\"%3A33932}%2C{\"id\"%3A33932}]%2C\"id\"%3A38144}%2C\"Body\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38127}%2C\"Hand\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38128}%2C\"Ears\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38064}%2C\"Weapon\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33933}]%2C\"id\"%3A38098}%2C\"Feet\"%3A{\"materia\"%3A[{\"id\"%3A33933}%2C{\"id\"%3A33931}]%2C\"id\"%3A38130}}%2C\"food\"%3A38264}]%2C\"race\"%3A\"Keepers of the Moon\"%2C\"level\"%3A90%2C\"ilvlSync\"%3A635%2C\"itemDisplaySettings\"%3A{\"maxILvl\"%3A650%2C\"minILvlFood\"%3A610%2C\"maxILvlFood\"%3A999%2C\"minILvl\"%3A630}%2C\"mfni\"%3Afalse%2C\"sims\"%3A[{\"settings\"%3A{\"hasScholar\"%3Afalse%2C\"hasDragoon\"%3Afalse%2C\"eProgPerMin\"%3A0%2C\"progPerMin\"%3A0%2C\"hasBard\"%3Afalse%2C\"toxPerMin\"%3A0%2C\"rezPerMin\"%3A0%2C\"eDiagPerMin\"%3A0%2C\"diagPerMin\"%3A0}%2C\"stub\"%3A\"sge-sheet-sim\"%2C\"name\"%3A\"SGE Sheet Sim\"}]%2C\"description\"%3A\"Sage's best-in-slot items for The Omega Protocol\"%2C\"mfMinGcd\"%3A2.05%2C\"mfp\"%3A[\"spellspeed\"%2C\"crit\"%2C\"dhit\"%2C\"determination\"%2C\"piety\"]%2C\"name\"%3A\"SGE TOP BiS\"%2C\"job\"%3A\"SGE\"}";
    //     setTimeout(() => {
    //         const body = dom.window.document.body;
    //         assert.ok(body.querySelector("gear-plan h1"));
    //         const plan = document.querySelector("gear-plan") as GearPlanSheet;
    //         assert.equal(plan.sets.length, 5, "Should have 5 sets");
    //         const firstSet = plan.sets[0];
    //         assert.equal(firstSet.name, "6.5 TOP BiS - Crit/Det Relic");
    //         assert.equal(firstSet.computedStats.gcdMag(2.5), 2.41);
    //         assert.equal(firstSet.computedStats.crit, 2515);
    //         assert.equal(firstSet.computedStats.critMulti, 1.622);
    //         assert.equal(firstSet.computedStats.critChance, 0.272);
    //         // assert.fail("foo")
    //         done();
    //     }, 10_000);
    // }).timeout(20_000);
});

import {DATA_API_CLIENT} from "../data_api_client";
import {expect} from "chai";
import {STATIC_SERVER} from "../external/static_bis";

describe("check that beta URLs weren't accidentally committed", () => {
    it('data api', () => {
        expect(DATA_API_CLIENT.baseUrl).to.eq('https://data.xivgear.app');
    });
    it('static bis', () => {
        expect(STATIC_SERVER.toString()).to.eq('https://staticbis.xivgear.app/');
    });
});

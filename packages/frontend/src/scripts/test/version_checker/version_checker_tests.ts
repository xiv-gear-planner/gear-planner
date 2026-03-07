import 'global-jsdom/register';
import {VersionChecker} from "../../version_checker/version_checker";
import {expect} from "chai";

function makeResponse(html: string): Response {
    return {
        ok: true,
        text: async () => html,
    } as unknown as Response;
}

describe("VersionPoller", () => {


    function makeDoc(html: string): Document {
        return new DOMParser().parseFromString(html, "text/html");
    }

    it("does not detect when main script does not change", async () => {
        const doc = makeDoc(`<!doctype html><html><head><script src="main.123.js"></script></head><body></body></html>`);

        let fetchCalls = 0;
        const html = `<!doctype html><html><head><script src="main.123.js"></script></head><body></body></html>`;
        const fetchFn = async (_url: URL) => {
            fetchCalls++;
            return makeResponse(html);
        };

        let detected = false;
        const poller = new VersionChecker({
            intervalMs: 0,
            fetchFn,
            getRemoteUrl: () => new URL("https://localhost:3000/index.html"),
            getCurrentDocument: () => doc,
            onDetected: () => {
                detected = true;
            },
        });

        poller.start();

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(detected, "should not detect changes when main script is stable").to.eq(false);
        expect(fetchCalls).to.be.greaterThanOrEqual(1, "fetch should have been called at least once");
    }).timeout(20_000);

    it("detects after required number of consecutive main script changes", async () => {
        const doc = makeDoc(`<!doctype html><html><head><script src="main.123.js"></script></head><body></body></html>`);

        const remoteHtmls = [
            `<!doctype html><html><head><script src="main.456.js"></script></head><body></body></html>`,
            `<!doctype html><html><head><script src="main.456.js"></script></head><body></body></html>`,
            `<!doctype html><html><head><script src="main.456.js"></script></head><body></body></html>`,
        ];
        let fetchIndex = 0;
        const fetchFn = async (_: URL) => {
            const html = remoteHtmls[Math.min(fetchIndex, remoteHtmls.length - 1)];
            fetchIndex++;
            return makeResponse(html);
        };

        let detectedCount = 0;
        const detectedPromise = new Promise<void>(resolve => {
            const poller = new VersionChecker({
                intervalMs: 0,
                fetchFn,
                getRemoteUrl: () => new URL("https://localhost:3000/index.html"),
                getCurrentDocument: () => doc,
                requiredConsecutiveChanges: 3,
                onDetected: () => {
                    detectedCount++;
                    resolve();
                },
            });
            poller.start();
        });

        await detectedPromise;

        expect(detectedCount).to.eq(1, "onDetected should be called exactly once");
        expect(fetchIndex).to.eq(3, "should have fetched three times");
    }).timeout(20_000);

    it("resets consecutive diffs when remote matches baseline again", async () => {
        const doc = makeDoc(`<!doctype html><html><head><script src="main.123.js"></script></head><body></body></html>`);

        const remoteHtmls = [
            `<!doctype html><html><head><script src="main.456.js"></script></head><body></body></html>`,
            `<!doctype html><html><head><script src="main.123.js"></script></head><body></body></html>`,
            `<!doctype html><html><head><script src="main.456.js"></script></head><body></body></html>`,
            // It will just repeat after this
        ];
        let fetchIndex = 0;
        const fetchFn = async (_: URL) => {
            const html = remoteHtmls[Math.min(fetchIndex, remoteHtmls.length - 1)];
            console.log(`fetchIndex ${fetchIndex}, html: `, html);
            fetchIndex++;
            return makeResponse(html);
        };

        let detected = false;
        const poller = new VersionChecker({
            intervalMs: 0,
            fetchFn: fetchFn,
            getRemoteUrl: () => new URL("https://localhost:30000/index.html"),
            getCurrentDocument: () => doc,
            requiredConsecutiveChanges: 3,
            onDetected: () => {
                detected = true;
            },
        });

        poller.start();

        await new Promise(resolve => setTimeout(resolve, 200));

        expect(detected, "should detect after enough consecutive problems").to.be.true;
        expect(fetchIndex).to.eq(5, "should have fetched five times before firing");
    }).timeout(20_000);

    it("resets consecutive diffs when remote matches baseline again 2", async () => {
        const doc = makeDoc(`<!doctype html><html><head><script src="main.123.js"></script></head><body></body></html>`);

        const remoteHtmls = [
            `<!doctype html><html><head><script src="main.456.js"></script></head><body></body></html>`,
            `<!doctype html><html><head><script src="main.123.js"></script></head><body></body></html>`,
            // It will just repeat after this
        ];
        let fetchIndex = 0;
        const fetchFn = async (_: URL) => {
            const html = remoteHtmls[fetchIndex % 2];
            console.log(`fetchIndex ${fetchIndex}, html: `, html);
            fetchIndex++;
            return makeResponse(html);
        };

        let detected = false;
        const poller = new VersionChecker({
            intervalMs: 50,
            fetchFn: fetchFn,
            getRemoteUrl: () => new URL("https://localhost:30000/index.html"),
            getCurrentDocument: () => doc,
            requiredConsecutiveChanges: 3,
            onDetected: () => {
                detected = true;
            },
        });

        poller.start();

        await new Promise(resolve => setTimeout(resolve, 500));

        expect(detected, "should detect after enough consecutive problems").to.be.false;
        // Allow some margin of error due to timing issues in tests
        expect(fetchIndex).to.be.greaterThanOrEqual(8);
        expect(fetchIndex).to.be.lessThanOrEqual(12);
    }).timeout(20_000);

});


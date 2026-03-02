// Not needed for functionality, but caching is nice
import '../polyfills';
import {expect} from "chai";
import {getJobIcons} from "../preload_helpers";
import {ALL_COMBAT_JOBS, JOB_DATA} from "@xivgear/xivmath/xivconstants";
import {
    HASH_QUERY_PARAM,
    ONLY_SET_QUERY_PARAM,
    PATH_SEPARATOR,
    SELECTION_INDEX_QUERY_PARAM
} from "@xivgear/core/nav/common_nav";
import {boolParam, getMergedQueryParams, intParam, stringParam} from "../server_utils";

describe('misc helpers', () => {
    describe("getJobIcons", () => {
        it("no condition returns everything", () => {
            const icons = getJobIcons('framed');
            expect(icons).to.have.length(ALL_COMBAT_JOBS.length);
        });

        it("filter works", () => {
            const icons = getJobIcons('frameless', job => JOB_DATA[job].role === 'Healer');
            expect(icons).to.have.length(4);
        });
    });

    describe("getMergedQueryParams", () => {
        it("should return direct query params when no url is present", () => {
            const params = {
                [HASH_QUERY_PARAM]: 'some-path',
                [ONLY_SET_QUERY_PARAM]: '1',
                [SELECTION_INDEX_QUERY_PARAM]: '2',
            };
            const request = {
                query: params,
            };

            const result = getMergedQueryParams(request, {
                [HASH_QUERY_PARAM]: stringParam,
                [ONLY_SET_QUERY_PARAM]: intParam,
                [SELECTION_INDEX_QUERY_PARAM]: intParam,
            });
            expect(result).to.deep.equal({
                [HASH_QUERY_PARAM]: 'some-path',
                [ONLY_SET_QUERY_PARAM]: 1,
                [SELECTION_INDEX_QUERY_PARAM]: 2,
            });
        });

        it("should merge params from encoded url", () => {
            const nestedUrl = `https://example.com/test?${HASH_QUERY_PARAM}=hash-in-url&otherParam=val2`;
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                    direct: 'directVal',
                },
            };

            const result = getMergedQueryParams(request, {
                [HASH_QUERY_PARAM]: stringParam,
                otherParam: stringParam,
            });
            expect(result).to.deep.include({
                [HASH_QUERY_PARAM]: 'hash-in-url',
                otherParam: 'val2',
            });
        });

        it("should merge params from unencoded url", () => {
            const nestedUrl = `https://example.com/test?${ONLY_SET_QUERY_PARAM}=true&otherParam=val2`;
            const request = {
                query: {
                    url: nestedUrl,
                },
            };

            const result = getMergedQueryParams(request, {
                [ONLY_SET_QUERY_PARAM]: boolParam,
                otherParam: stringParam,
            });
            expect(result).to.deep.include({
                [ONLY_SET_QUERY_PARAM]: true,
                otherParam: 'val2',
            });
        });

        it("should not override direct params with url params", () => {
            const nestedUrl = `https://example.com/test?${HASH_QUERY_PARAM}=urlVal&otherParam=val2`;
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                    [HASH_QUERY_PARAM]: 'directVal',
                },
            };

            const result = getMergedQueryParams(request, {
                [HASH_QUERY_PARAM]: stringParam,
                otherParam: stringParam,
            });
            expect(result).to.deep.include({
                [HASH_QUERY_PARAM]: 'directVal',
                otherParam: 'val2',
            });
        });

        it("should handle relative urls in url param", () => {
            const nestedUrl = `?${ONLY_SET_QUERY_PARAM}=true`;
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                },
            };

            const result = getMergedQueryParams(request, {
                [ONLY_SET_QUERY_PARAM]: boolParam,
            });
            expect(result).to.deep.include({
                [ONLY_SET_QUERY_PARAM]: true,
            });
        });

        it("should handle bare query strings in url param", () => {
            const nestedUrl = `?${HASH_QUERY_PARAM}=bareVal`;
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                },
            };

            const result = getMergedQueryParams(request, {
                [HASH_QUERY_PARAM]: stringParam,
            });
            expect(result).to.deep.include({
                [HASH_QUERY_PARAM]: 'bareVal',
            });
        });

        it("should handle invalid urls gracefully", () => {
            const request = {
                query: {
                    url: 'not-a-url-at-all',
                },
            };

            const result = getMergedQueryParams(request, {
                url: stringParam,
            });
            // It might still try to parse it as a relative URL if it doesn't throw,
            // but if it's completely invalid it should just return what it had.
            expect(result).to.deep.equal({
                url: 'not-a-url-at-all',
            });
        });

        it("should handle missing query object", () => {
            const request = {};
            const result = getMergedQueryParams(request, {});
            expect(result).to.deep.equal({});
        });

        it("should use hash as page parameter if page is not present", () => {
            const nestedUrl = "https://example.com/#/sl/1234";
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                },
            };

            const result = getMergedQueryParams(request, {
                [HASH_QUERY_PARAM]: stringParam,
            });
            expect(result).to.deep.include({
                [HASH_QUERY_PARAM]: `sl${PATH_SEPARATOR}1234`,
            });
        });

        it("should not use hash if page parameter is already present", () => {
            const nestedUrl = `https://example.com/?${HASH_QUERY_PARAM}=direct-page#/sl/1234`;
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                },
            };

            const result = getMergedQueryParams(request, {
                [HASH_QUERY_PARAM]: stringParam,
            });
            expect(result).to.deep.include({
                [HASH_QUERY_PARAM]: 'direct-page',
            });
        });

        it("should handle hash with multiple parts", () => {
            const nestedUrl = "https://example.com/#/part1/part2/part3";
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                },
            };

            const result = getMergedQueryParams(request, {
                [HASH_QUERY_PARAM]: stringParam,
            });
            expect(result).to.deep.include({
                [HASH_QUERY_PARAM]: `part1${PATH_SEPARATOR}part2${PATH_SEPARATOR}part3`,
            });
        });

        it("should correctly handle boolean parameter for exportAsSheet", () => {
            const request = {
                query: {
                    exportAsSheet: 'true',
                },
            };

            const result = getMergedQueryParams(request, {
                exportAsSheet: boolParam,
            });
            expect(result.exportAsSheet).to.be.true;

            const requestFalse = {
                query: {
                    exportAsSheet: 'false',
                },
            };

            const resultFalse = getMergedQueryParams(requestFalse, {
                exportAsSheet: boolParam,
            });
            expect(resultFalse.exportAsSheet).to.be.false;
        });

        it("should correctly handle boolean parameter if Fastify already parsed it as boolean", () => {
            const request = {
                query: {
                    exportAsSheet: true,
                },
            };

            const result = getMergedQueryParams(request, {
                exportAsSheet: boolParam,
            });
            expect(result.exportAsSheet).to.be.true;

            const requestFalse = {
                query: {
                    exportAsSheet: false,
                },
            };

            const resultFalse = getMergedQueryParams(requestFalse, {
                exportAsSheet: boolParam,
            });
            expect(resultFalse.exportAsSheet).to.be.false;
        });

        it("should correctly handle boolean parameter in URL", () => {
            const nestedUrl = "https://example.com/?exportAsSheet=true";
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                },
            };

            const result = getMergedQueryParams(request, {
                exportAsSheet: boolParam,
            });
            expect(result.exportAsSheet).to.be.true;
        });

        it("should correctly handle boolean parameter in URL as false", () => {
            const nestedUrl = "https://example.com/?exportAsSheet=false";
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                },
            };

            const result = getMergedQueryParams(request, {
                exportAsSheet: boolParam,
            });
            expect(result.exportAsSheet).to.be.false;
        });
    });
});

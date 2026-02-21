import '../polyfills';
import {expect} from "chai";
import {getJobIcons} from "../preload_helpers";
import {ALL_COMBAT_JOBS, JOB_DATA} from "@xivgear/xivmath/xivconstants";
import {getMergedQueryParams, SheetRequest} from "../server_builder";
import {
    HASH_QUERY_PARAM,
    ONLY_SET_QUERY_PARAM,
    PATH_SEPARATOR,
    SELECTION_INDEX_QUERY_PARAM
} from "@xivgear/core/nav/common_nav";

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
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
            expect(result).to.deep.equal(params);
        });

        it("should merge params from encoded url", () => {
            const nestedUrl = `https://example.com/test?${HASH_QUERY_PARAM}=hash-in-url&otherParam=val2`;
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                    direct: 'directVal',
                },
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
            expect(result).to.deep.equal({
                url: encodeURIComponent(nestedUrl),
                direct: 'directVal',
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
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
            expect(result).to.deep.include({
                [ONLY_SET_QUERY_PARAM]: 'true',
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
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
            expect(result).to.deep.equal({
                url: encodeURIComponent(nestedUrl),
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
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
            expect(result).to.deep.include({
                [ONLY_SET_QUERY_PARAM]: 'true',
            });
        });

        it("should handle bare query strings in url param", () => {
            const nestedUrl = `?${HASH_QUERY_PARAM}=bareVal`;
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                },
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
            expect(result).to.deep.include({
                [HASH_QUERY_PARAM]: 'bareVal',
            });
        });

        it("should handle invalid urls gracefully", () => {
            const request = {
                query: {
                    url: 'not-a-url-at-all',
                },
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
            // It might still try to parse it as a relative URL if it doesn't throw,
            // but if it's completely invalid it should just return what it had.
            expect(result).to.deep.equal({
                url: 'not-a-url-at-all',
            });
        });

        it("should handle missing query object", () => {
            const request = {} as unknown as SheetRequest;
            const result = getMergedQueryParams(request);
            expect(result).to.deep.equal({});
        });

        it("should use hash as page parameter if page is not present", () => {
            const nestedUrl = "https://example.com/#/sl/1234";
            const request = {
                query: {
                    url: encodeURIComponent(nestedUrl),
                },
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
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
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
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
            } as unknown as SheetRequest;

            const result = getMergedQueryParams(request);
            expect(result).to.deep.include({
                [HASH_QUERY_PARAM]: `part1${PATH_SEPARATOR}part2${PATH_SEPARATOR}part3`,
            });
        });
    });
});

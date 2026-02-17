import {NavPath, NavState, parsePath, splitHashLegacy, splitPath} from "../nav/common_nav";
import {expect} from "chai";

describe('path splitting and joining', () => {
    it('legacy handling converts properly', () => {
        const pathOriginal = '#/foo|bar/asdf|zxcv';
        const legacySplit = splitHashLegacy(pathOriginal);
        expect(legacySplit).to.deep.equals(['foo|bar', 'asdf|zxcv']);
    });
    it('splitting splits properly', () => {
        const pathOriginal = 'foo/bar|asdf/zxcv';
        const newSplit = splitPath(pathOriginal);
        expect(newSplit).to.deep.equals(['foo/bar', 'asdf/zxcv']);
    });
});

describe('parsePath', () => {

    describe('mysheets', () => {
        it('resolves empty path to mysheets', () => {
            const result = parsePath(new NavState([]));
            expect(result).to.deep.equals({
                type: 'mysheets',
            });
        });
        it('resolves raw embed to null', () => {
            const result = parsePath(new NavState(['embed']));
            expect(result).to.be.null;
        });
    });

    describe('saved sheets', () => {
        it('resolves saved sheet path', () => {
            const result = parsePath(new NavState(['sheet', 'foo']));
            expect(result).to.deep.equals({
                type: 'saved',
                viewOnly: false,
                saveKey: 'foo',
                embed: false,
            });
        });
        it('does not try to embed saved sheet', () => {
            const result = parsePath(new NavState(['embed', 'sheet', 'foo']));
            expect(result).to.deep.equals({
                type: 'saved',
                viewOnly: false,
                saveKey: 'foo',
                embed: false,
            });
        });
    });

    describe('newsheet', () => {
        it('resolves newsheet path', () => {
            const result = parsePath(new NavState(['newsheet']));
            expect(result).to.deep.equals({
                type: 'newsheet',
            });
        });
        it('does not try to embed newsheet', () => {
            const result = parsePath(new NavState(['embed', 'newsheet']));
            expect(result).to.deep.equals({
                type: 'newsheet',
            });
        });
        it('resolves import form', () => {
            const result = parsePath(new NavState(['importsheet']));
            expect(result).to.deep.equals({
                type: 'importform',
            });
        });
    });

    describe('importsheet', () => {
        it('does not try to embed import form', () => {
            const result = parsePath(new NavState(['embed', 'importsheet']));
            expect(result).to.deep.equals({
                type: 'importform',
            });
        });
        it('resolves import sheet', () => {
            const setValue = {
                foo: 'bar|baz',
            };
            const result = parsePath(new NavState(['importsheet', JSON.stringify(setValue)]));
            expect(result).to.deep.equals({
                type: 'sheetjson',
                jsonBlob: setValue,
                embed: false,
                viewOnly: false,
                defaultSelectionIndex: undefined,
                onlySetIndex: undefined,
            } satisfies NavPath);
        });
        it('does not try to embed import sheet', () => {
            const setValue = {
                foo: 'bar|baz',
            };
            const result = parsePath(new NavState(['embed', 'importsheet', JSON.stringify(setValue)]));
            expect(result).to.deep.equals({
                type: 'sheetjson',
                jsonBlob: setValue,
                embed: false,
                viewOnly: false,
                defaultSelectionIndex: undefined,
                onlySetIndex: undefined,
            } satisfies NavPath);
        });
    });

    describe('viewsheet', () => {
        it('resolves view sheet', () => {
            const setValue = {
                foo: 'bar|baz',
            };
            const result = parsePath(new NavState(['viewsheet', JSON.stringify(setValue)]));
            expect(result).to.deep.equals({
                type: 'sheetjson',
                jsonBlob: setValue,
                embed: false,
                viewOnly: true,
                defaultSelectionIndex: undefined,
                onlySetIndex: undefined,
            } satisfies NavPath);
        });
        it('does not try to embed view sheet', () => {
            const setValue = {
                foo: 'bar|baz',
            };
            const result = parsePath(new NavState(['embed', 'viewsheet', JSON.stringify(setValue)]));
            expect(result).to.deep.equals({
                type: 'sheetjson',
                jsonBlob: setValue,
                embed: false,
                viewOnly: true,
                defaultSelectionIndex: undefined,
                onlySetIndex: undefined,
            } satisfies NavPath);
        });
    });

    describe('importset', () => {
        it('resolves import set', () => {
            const setValue = {
                foo: 'bar|baz',
            };
            const result = parsePath(new NavState(['importset', JSON.stringify(setValue)]));
            expect(result).to.deep.equals({
                type: 'setjson',
                jsonBlob: setValue,
                embed: false,
                viewOnly: false,
            });
        });

        it('does not try to embed import set', () => {
            const setValue = {
                foo: 'bar|baz',
            };
            const result = parsePath(new NavState(['embed', 'importset', JSON.stringify(setValue)]));
            expect(result).to.deep.equals({
                type: 'setjson',
                jsonBlob: setValue,
                embed: false,
                viewOnly: false,
            });
        });
    });

    describe('viewset', () => {
        it('resolves view set', () => {
            const setValue = {
                foo: 'bar|baz',
            };
            const result = parsePath(new NavState(['viewset', JSON.stringify(setValue)]));
            expect(result).to.deep.equals({
                type: 'setjson',
                jsonBlob: setValue,
                embed: false,
                viewOnly: true,
            });
        });
        it('can embed view set', () => {
            const setValue = {
                foo: 'bar|baz',
            };
            const result = parsePath(new NavState(['embed', 'viewset', JSON.stringify(setValue)]));
            expect(result).to.deep.equals({
                type: 'setjson',
                jsonBlob: setValue,
                embed: true,
                viewOnly: true,
            });
        });
    });


    describe('shortlink', () => {

        it('can resolve shortlink', () => {
            const result = parsePath(new NavState(['sl', 'asdf']));
            expect(result).to.deep.equals({
                type: 'shortlink',
                uuid: 'asdf',
                embed: false,
                viewOnly: true,
                onlySetIndex: undefined,
                defaultSelectionIndex: undefined,
            } satisfies NavPath);
        });
        it('can embed shortlink', () => {
            const result = parsePath(new NavState(['embed', 'sl', 'asdf']));
            expect(result).to.deep.equals({
                type: 'shortlink',
                uuid: 'asdf',
                embed: true,
                viewOnly: true,
                onlySetIndex: undefined,
                defaultSelectionIndex: undefined,
            });
        });
        it('can handle selection index', () => {
            const result = parsePath(new NavState(['embed', 'sl', 'asdf'], undefined, 3));
            expect(result).to.deep.equals({
                type: 'shortlink',
                uuid: 'asdf',
                embed: true,
                viewOnly: true,
                onlySetIndex: undefined,
                defaultSelectionIndex: 3,
            });
        });
        it('can handle exclusive index', () => {
            const result = parsePath(new NavState(['embed', 'sl', 'asdf'], 2, undefined));
            expect(result).to.deep.equals({
                type: 'shortlink',
                uuid: 'asdf',
                embed: true,
                viewOnly: true,
                onlySetIndex: 2,
                defaultSelectionIndex: undefined,
            });
        });
        it('returns null if no link', () => {
            const result = parsePath(new NavState(['sl']));
            expect(result).to.be.null;
        });
    });

    describe('bis', () => {
        it('can resolve bis', () => {
            const result = parsePath(new NavState(['bis', 'sge', 'endwalker', 'anabaseios']));
            expect(result).to.deep.equals({
                type: 'bis',
                path: ['sge', 'endwalker', 'anabaseios'],
                job: 'sge',
                folder: 'endwalker',
                sheet: 'anabaseios',
                embed: false,
                viewOnly: true,
                onlySetIndex: undefined,
                defaultSelectionIndex: undefined,
            });
        });
        it('can embed bis', () => {
            const result = parsePath(new NavState(['embed', 'bis', 'sge', 'endwalker', 'anabaseios'], 1));
            expect(result).to.deep.equals({
                type: 'bis',
                path: ['sge', 'endwalker', 'anabaseios'],
                job: 'sge',
                folder: 'endwalker',
                sheet: 'anabaseios',
                embed: true,
                viewOnly: true,
                onlySetIndex: 1,
                defaultSelectionIndex: undefined,
            });
        });
        it('can resolve bis with selection index', () => {
            const result = parsePath(new NavState(['bis', 'sge', 'endwalker', 'anabaseios'], undefined, 5));
            expect(result).to.deep.equals({
                type: 'bis',
                path: ['sge', 'endwalker', 'anabaseios'],
                job: 'sge',
                folder: 'endwalker',
                sheet: 'anabaseios',
                embed: false,
                viewOnly: true,
                onlySetIndex: undefined,
                defaultSelectionIndex: 5,
            });
        });
        it('can resolve bis with exclusive index', () => {
            const result = parsePath(new NavState(['bis', 'sge', 'endwalker', 'anabaseios'], 4, undefined));
            expect(result).to.deep.equals({
                type: 'bis',
                path: ['sge', 'endwalker', 'anabaseios'],
                job: 'sge',
                folder: 'endwalker',
                sheet: 'anabaseios',
                embed: false,
                viewOnly: true,
                onlySetIndex: 4,
                defaultSelectionIndex: undefined,
            });
        });
        it('can resolve bis without a folder', () => {
            const result = parsePath(new NavState(['bis', 'war', 'current'], 4, undefined));
            expect(result).to.deep.equals({
                type: 'bis',
                path: ['war', 'current'],
                job: 'war',
                sheet: 'current',
                embed: false,
                viewOnly: true,
                onlySetIndex: 4,
                defaultSelectionIndex: undefined,
            });
        });
        it('can resolve bis with more than 3 parts', () => {
            const result = parsePath(new NavState(['bis', 'war', 'foo', 'bar', 'baz'], 4, undefined));
            expect(result).to.deep.equals({
                type: 'bis',
                path: ['war', 'foo', 'bar', 'baz'],
                job: 'war',
                folder: 'foo',
                sheet: 'baz',
                embed: false,
                viewOnly: true,
                onlySetIndex: 4,
                defaultSelectionIndex: undefined,
            });
        });
    });

});

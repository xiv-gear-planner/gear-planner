import {JobName} from "@xivgear/xivmath/xivconstants";

export type BaseNode = {
    fileName: string,
    parent?: DirNode,
    pathPart: string,
    path: string[],
}

export type LeafNode = BaseNode & {
    type: 'file',
    contentName?: string,
    contentDescription?: string,
}

export type DirNode = BaseNode & {
    type: 'dir',
    children: AnyNode[],
}

export type JobNode = DirNode & {
    fileName: JobName;
    job: JobName;
}

export function isDirNode(node: AnyNode | undefined  | null): node is DirNode {
    return node && node.type === 'dir';
}

export function isLeafNode(node: AnyNode | undefined  | null): node is LeafNode {
    return node && node.type === 'file';
}

export type AnyNode = LeafNode | DirNode;

export const STATIC_SERVER: URL = new URL("https://staticbis.xivgear.app/");

const STORAGE_KEY = 'staticbis-server-override';


export interface BisService {
    getBisSheetFetchUrl(path: string[]): URL;

    getBisSheet(path: string[]): Promise<string>;

    getBisIndexUrl(): URL;

    getBisIndex(): Promise<DirNode>;

    getBisIndexAt(path: string[]): Promise<AnyNode | BisIndexError>;
}

export class BisServiceImpl implements BisService {
    constructor(private readonly serverOverride?: URL | null | undefined | string) {
    }

    private getServer() {
        if (this.serverOverride) {
            try {
                return new URL(this.serverOverride);
            }
            catch (e) {
                console.error('Invalid override URL, using default', this.serverOverride);
            }
        }
        if (typeof localStorage !== 'undefined') {
            const override = localStorage.getItem(STORAGE_KEY);
            if (override) {
                try {
                    return new URL(override);
                }
                catch (e) {
                    console.error('Invalid override URL, using default', override);
                }
            }
        }
        return STATIC_SERVER;
    }

    getBisSheetFetchUrl(path: string[]): URL {
        let current: URL = new URL(this.getServer());
        for (let i = 0; i < path.length - 1; i++) {
            current = new URL(`./${encodeURIComponent(path[i])}/`, current);
        }
        current = new URL(`./${encodeURIComponent(path[path.length - 1])}.json`, current);
        return current;
    }

    async getBisSheet(path: string[]): Promise<string> {
        const FULL_URL = this.getBisSheetFetchUrl(path);
        return await fetch(FULL_URL).then(response => response.text());
    }

    getBisIndexUrl(): URL {
        return new URL(`/_index.json`, this.getServer());
    }

    async getBisIndex(): Promise<DirNode> {
        const url = this.getBisIndexUrl();
        const out = await fetch(url).then(response => response.json()) as DirNode;
        finalizeNode(out);
        return out;
    }

    async getBisIndexAt(path: string[]): Promise<AnyNode | BisIndexError> {
        let current: AnyNode = await this.getBisIndex();
        for (const pathPart of path) {
            if (current.type === 'file') {
                return {
                    type: 'error',
                    offendingPathPart: pathPart,
                    reason: `${pathPart} is not a directory`,
                };
            }
            current = current.children.find(node => node.pathPart === pathPart);
            if (!current) {
                return {
                    type: 'error',
                    offendingPathPart: pathPart,
                    reason: `${pathPart} does not exist`,
                };
            }
        }
        return current;
    }
}

export class MockBisService implements BisService {
    private _index: DirNode | null = null;
    private readonly sheets = new Map<string, string>();

    constructor(initialIndex?: DirNode) {
        this._index = initialIndex ?? null;
    }

    addSheet(path: string[], content: string) {
        this.sheets.set(path.join('/'), content);
        this._index = null;
    }

    getBisSheetFetchUrl(path: string[]): URL {
        return new URL(`https://mockbis.xivgear.app/${path.join('/')}.json`);
    }

    async getBisSheet(path: string[]): Promise<string> {
        const content = this.sheets.get(path.join('/'));
        if (content === undefined) {
            throw new Error(`BiS sheet not found: ${path.join('/')}`);
        }
        return content;
    }

    getBisIndexUrl(): URL {
        return new URL(`https://mockbis.xivgear.app/_index.json`);
    }

    async getBisIndex(): Promise<DirNode> {
        if (this._index === null) {
            this._index = this.regenerateIndex();
        }
        return this._index;
    }

    async getBisIndexAt(path: string[]): Promise<AnyNode | BisIndexError> {
        let current: AnyNode = await this.getBisIndex();
        for (const pathPart of path) {
            if (current.type === 'file') {
                return {
                    type: 'error',
                    offendingPathPart: pathPart,
                    reason: `${pathPart} is not a directory`,
                };
            }
            current = current.children.find(node => node.pathPart === pathPart);
            if (!current) {
                return {
                    type: 'error',
                    offendingPathPart: pathPart,
                    reason: `${pathPart} does not exist`,
                };
            }
        }
        return current;
    }

    private regenerateIndex(): DirNode {
        const root: DirNode = {
            type: 'dir',
            fileName: '',
            pathPart: '',
            path: [],
            children: [],
        };

        for (const [pathStr, content] of this.sheets.entries()) {
            const pathParts = pathStr.split('/');
            let currentDir = root;

            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                const isLast = i === pathParts.length - 1;

                if (isLast) {
                    const sheetData = JSON.parse(content);
                    const leaf: LeafNode = {
                        type: 'file',
                        fileName: part + '.json',
                        pathPart: part,
                        path: [...currentDir.path, part],
                        parent: currentDir,
                        contentName: sheetData.name,
                        contentDescription: sheetData.description,
                    };
                    currentDir.children.push(leaf);
                }
                else {
                    let nextDir = currentDir.children.find(n => n.type === 'dir' && n.pathPart === part) as DirNode;
                    if (!nextDir) {
                        nextDir = {
                            type: 'dir',
                            fileName: part,
                            pathPart: part,
                            path: [...currentDir.path, part],
                            parent: currentDir,
                            children: [],
                        };
                        currentDir.children.push(nextDir);
                    }
                    currentDir = nextDir;
                }
            }
        }
        return root;
    }
}

function getServer() {
    const override = localStorage.getItem(STORAGE_KEY);
    if (override) {
        try {
            return new URL(override);
        }
        catch (e) {
            console.error('Invalid override URL, using default', override);
        }
    }
    return STATIC_SERVER;
}

export function getBisSheetFetchUrl(path: string[]): URL {
    let current: URL = new URL(getServer());
    for (let i = 0; i < path.length - 1; i++) {
        current = new URL(`./${encodeURIComponent(path[i])}/`, current);
    }
    current = new URL(`./${encodeURIComponent(path[path.length - 1])}.json`, current);
    return current;
}

export async function getBisSheet(...params: Parameters<typeof getBisSheetFetchUrl>): Promise<string> {
    const FULL_URL = getBisSheetFetchUrl(...params);
    return await fetch(FULL_URL).then(response => response.text());
}

export function getBisIndexUrl(): URL {
    return new URL(`/_index.json`, getServer());
}

/**
 * Retrieve the root BiS browser index.
 */
export async function getBisIndex(): Promise<DirNode> {
    const url = getBisIndexUrl();
    const out = await fetch(url).then(response => response.json()) as DirNode;
    finalizeNode(out);
    return out;
}

export type BisIndexError = {
    type: 'error',
    offendingPathPart: string,
    reason: string,
}

/**
 * Retrieve the root BiS browser index and then navigate through it.
 *
 * @param path The path to navigate to
 * @return A promise containing either the node described in path, or a string representing the part of the path which
 * could not be resolved.
 */
export async function getBisIndexAt(path: string[]): Promise<AnyNode | BisIndexError> {
    let current: AnyNode = await getBisIndex();
    for (const pathPart of path) {
        if (current.type === 'file') {
            return {
                type: 'error',
                offendingPathPart: pathPart,
                reason: `${pathPart} is not a directory`,
            };
        }
        current = current.children.find(node => node.pathPart === pathPart);
        if (!current) {
            return {
                type: 'error',
                offendingPathPart: pathPart,
                reason: `${pathPart} does not exist`,
            };
        }
    }
    return current;
}

function finalizeNode(node: AnyNode): void {
    const pathPath = node.type === 'file' ? stripFilename(node.fileName) : node.fileName;
    node.pathPart = pathPath;
    if (node.parent) {
        // TODO: fileName is wrong
        node.path = [...node.parent.path, pathPath];
    }
    else {
        node.path = [];
    }
    if (node.type === 'dir') {
        node.children.forEach(child => {
            child.parent = node;
            finalizeNode(child);
        });
    }
}

/**
 * Remove '.json' extension.
 *
 * @param filename
 */
export function stripFilename(filename: string): string {
    if (filename.toLowerCase().endsWith(".json")) {
        return filename.substring(0, filename.length - 5);
    }
    return filename;
}



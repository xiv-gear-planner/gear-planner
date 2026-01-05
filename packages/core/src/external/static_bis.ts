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

export type AnyNode = LeafNode | DirNode;

export const STATIC_SERVER: URL = new URL("https://staticbis.xivgear.app/");

const STORAGE_KEY = 'staticbis-server-override';

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

export function setServerOverride(server: string) {
    // Validate URL
    new URL(server);
    localStorage.setItem(STORAGE_KEY, server);
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

/**
 * Set the 'parent' link on children to this node, recursively.
 *
 * @param node
 */
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

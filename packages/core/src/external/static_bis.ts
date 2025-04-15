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

export type AnyNode = LeafNode | DirNode;

const STATIC_SERVER: URL = new URL("https://staticbis.xivgear.app/");

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

export function getBisSheetFetchUrl(job: JobName, folder: string, sheetFileName: string): URL {
    if (folder) {
        return new URL(`/${encodeURIComponent(job)}/${encodeURIComponent(folder)}/${encodeURIComponent(sheetFileName)}.json`, getServer());
    }
    return new URL(`/${encodeURIComponent(job)}/${encodeURIComponent(sheetFileName)}.json`, getServer());
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

export async function getBisIndex(): Promise<DirNode> {
    const url = new URL(`/_index.json`, getServer());
    const out = await fetch(url).then(response => response.json()) as DirNode;
    finalizeNode(out);
    return out;
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

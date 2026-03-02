const defaultClientPath = new URL('https://xivgear.app/');
const defaultStaticFilePath = new URL('https://xivgear.app/');

export type FrontendFileServerProvider = {
    /**
     * Get the upstream URL which hosts the static files.
     */
    get staticFilePath(): URL;
    /**
     * Get the URL at which this instance is exposed.
     */
    get frontendClientPath(): URL;
}

export function frontendPaths(overrides: Partial<FrontendFileServerProvider> = {}): FrontendFileServerProvider {
    return {
        staticFilePath: overrides.staticFilePath || defaultStaticFilePath,
        frontendClientPath: overrides.frontendClientPath || defaultClientPath,
    };
}

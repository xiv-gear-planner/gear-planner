let _path = 'https://xivgear.app/';
let _server = 'https://xivgear.app/';

/**
 * Get the upstream URL which hosts the static files.
 */
export function getFrontendServer() {
    return _server;
}

export function setFrontendServer(server: string) {
    _server = server;
}

/**
 * Get the URL at which this instance is exposed.
 */
export function getFrontendClientPath() {
    return _path;
}
export function setFrontendClientPath(path: string) {
    _path = path;
}

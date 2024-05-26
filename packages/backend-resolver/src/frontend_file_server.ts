let _path = 'https://xivgear.app/';
let _server = 'https://xivgear.app/';

export function getFrontendServer() {
    return _server;
}

export function setFrontendServer(server: string) {
    _server = server;
}
export function getFrontendPath() {
    return _path;
}
export function setFrontendClient(path: string) {
    _path = path;
}

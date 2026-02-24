import * as fs from 'fs';
import * as path from 'path';
import {StatsServer} from "../stats_server";
import {NavDataServiceImpl} from "../server_utils";
import {MockShortlinkService} from "@xivgear/core/external/shortlink_server";
import {MockBisService} from "@xivgear/core/external/static_bis";

export function makeMockShortlinkService() {
    const sls = new MockShortlinkService("https://api.xivgear.app/shortlink");
    const dataDir = path.join(__dirname, 'data', 'shortlinks');
    if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const uuid = path.basename(file, '.json');
                const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
                sls.addShortlink(uuid, content);
            }
        }
    }
    return sls;
}

export function makeMockBisService() {
    const dataDir = path.join(__dirname, 'data', 'bis');
    const bis = new MockBisService();

    function scanDir(currentDir: string, currentPath: string[]) {
        if (!fs.existsSync(currentDir)) return;
        const entries = fs.readdirSync(currentDir, {withFileTypes: true});
        for (const entry of entries) {
            if (entry.isDirectory()) {
                scanDir(path.join(currentDir, entry.name), [...currentPath, entry.name]);
            }
            else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== '_index.json') {
                const sheetPath = [...currentPath, path.basename(entry.name, '.json')];
                const content = fs.readFileSync(path.join(currentDir, entry.name), 'utf-8');
                bis.addSheet(sheetPath, content);
            }
        }
    }

    scanDir(dataDir, []);

    return bis;
}

export function makeStatsServer() {
    const sls = makeMockShortlinkService();
    const bis = makeMockBisService();
    const statsServer = new StatsServer(sls, new NavDataServiceImpl(sls, bis), bis);
    return statsServer;
}

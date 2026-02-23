import * as fs from 'fs';
import * as path from 'path';
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

    // Register sheets
    const sheets = [
        {path: ['sge', 'archive', 'anabaseios'], file: 'sge_archive_anabaseios.json'},
        {path: ['war', 'prog'], file: 'war_prog.json'},
        {path: ['war', 'archive', '7.2-prog'], file: 'war_archive_7.2-prog.json'},
    ];

    for (const sheet of sheets) {
        const content = fs.readFileSync(path.join(dataDir, sheet.file), 'utf-8');
        bis.addSheet(sheet.path, content);
    }

    return bis;
}

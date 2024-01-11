import {SHARE_LINK, SHORTLINK_HASH} from "../main";

const SHORTLINK_SERVER: URL = new URL("https://api.xivgear.app/shortlink/");

const STORAGE_KEY = 'shortlink-server-override';

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
    return SHORTLINK_SERVER;
}

export function setServerOverride(server: string) {
    // Validate URL
    new URL(server);
    localStorage.setItem(STORAGE_KEY, server);
}

export async function getShortLink(stub: string): Promise<string> {
    const FULL_URL = new URL(encodeURIComponent(stub), getServer());
    return await fetch(FULL_URL).then(response => response.text());
    // return "{\"name\":\"AST tier test\",\"sets\":[{\"name\":\"Default Set\",\"items\":{}},{\"name\":\"2.34\",\"items\":{\"Weapon\":{\"id\":40177,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"Head\":{\"id\":40210,\"materia\":[{\"id\":33932},{\"id\":33932}]},\"Body\":{\"id\":40211,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"Hand\":{\"id\":40137,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"Legs\":{\"id\":40138,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"Feet\":{\"id\":40214,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"Ears\":{\"id\":40148,\"materia\":[{\"id\":-1},{\"id\":-1}]},\"Neck\":{\"id\":40228,\"materia\":[{\"id\":-1},{\"id\":-1}]},\"Wrist\":{\"id\":40233,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"RingLeft\":{\"id\":40163,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"RingRight\":{\"id\":40088,\"materia\":[{\"id\":33931},{\"id\":33931}]}},\"food\":39876},{\"name\":\"2.34 copy\",\"items\":{\"Weapon\":{\"id\":40177,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"Head\":{\"id\":39675,\"materia\":[{\"id\":33932},{\"id\":33931},{\"id\":33931},{\"id\":33919},{\"id\":33918}]},\"Body\":{\"id\":40061,\"materia\":[{\"id\":33932},{\"id\":33932}]},\"Hand\":{\"id\":40062,\"materia\":[{\"id\":33931},{\"id\":33931}]},\"Legs\":{\"id\":40138,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"Feet\":{\"id\":40214,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"Ears\":{\"id\":40148,\"materia\":[{\"id\":33932},{\"id\":33932}]},\"Neck\":{\"id\":40228,\"materia\":[{\"id\":33932},{\"id\":33932}]},\"Wrist\":{\"id\":40233,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"RingLeft\":{\"id\":40163,\"materia\":[{\"id\":33942},{\"id\":33942}]},\"RingRight\":{\"id\":40088,\"materia\":[{\"id\":33931},{\"id\":33931}]}},\"food\":39876},{\"name\":\"Default Set copy\",\"items\":{}}],\"level\":90,\"job\":\"AST\",\"partyBonus\":0,\"race\":\"Raen\",\"sims\":[{\"stub\":\"pr-sim\",\"settings\":{},\"name\":\"Dmg/100p\"}],\"itemDisplaySettings\":{\"minILvl\":640,\"maxILvl\":999,\"minILvlFood\":640,\"maxILvlFood\":999},\"mfni\":false,\"mfp\":[\"crit\",\"dhit\",\"determination\",\"spellspeed\",\"piety\"]}";
}

export async function putShortLink(content: string): Promise<URL> {
    return await fetch(getServer(), {
        method: "POST",
        body: content
    }).then(response => response.text()).then(uuid => {
        // If on prod, use the fancy share link.
        if (document.location.hostname.toLowerCase() === 'xivgear.app') {
            return new URL(`${SHARE_LINK}${uuid}`);
        }
        else {
            return new URL(`#/${SHORTLINK_HASH}/${uuid}`, document.location.toString());
        }
    });
}
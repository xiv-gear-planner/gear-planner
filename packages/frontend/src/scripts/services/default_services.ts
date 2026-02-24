import {ShortlinkServiceImpl} from "@xivgear/core/external/shortlink_server";
import {BisServiceImpl} from "@xivgear/core/external/static_bis";

// Default service objects for the frontend specifically, since it is a bit too tangled at the moment to
// properly plumb everything.

export const DEFAULT_SHORTLINK_SERVICE = new ShortlinkServiceImpl();
export const DEFAULT_BIS_SERVICE = new BisServiceImpl();

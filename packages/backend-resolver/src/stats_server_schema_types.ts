import {SetExportExternalSingle, SheetExport, SheetStatsExport} from "@xivgear/xivmath/geartypes";

/*
This file is the top-level "entry point" of sorts for schema generation.
Anything that we might need to have in the swagger spec should be in this file, directly or indirectly.
 */

/**
 * Response of an embed validation response. Returns isValid: true and no message, or isValid: false and a message.
 */
export type EmbedCheckResponse = {
    isValid: true,
} | {
    isValid: false,
    reason: string,
}

/**
 * Response for putting an individual set.
 */
export type PutSetResponse = {
    /**
     * The direct URL to this set
     */
    url: string,
    /**
     * The embedded version of the direct URL to this set
     */
    embedUrl: string,
}

/**
 * Response for putting a full sheet.
 */
export type PutSheetResponse = {
    /**
     * The direct URL to the overall sheet.
     */
    url: string,
    /**
     * URLs for each individual set. Does not include separators. Use the index property to correlate them back to
     * sets in the original input.
     */
    sets: ({
        /**
         * The index of the set based on the original list.
         */
        index: number,
        /**
         * A URL which links to the sheet, but with this set pre-selected.
         */
        preSelectUrl: string,
    } & PutSetResponse)[],
}

// Should be identical to ExportedData, just doing this to avoid unwanted importing
export type BaseDataResponse = SheetExport | SetExportExternalSingle;
export type FullDataResponse = SheetStatsExport;

/**
 * Base parameters for locating a particular sheet or set.
 */
export type BaseQueryParams = {
    /**
     * The page parameter, which can be a shortlink (sl|<uuid>), a BiS sheet (bis|<job>|<sheet>), or a legacy UUID.
     */
    page?: string;
    /**
     * If provided, only the set at this index will be loaded. This is often used for embedding or extracting a single set.
     */
    onlySetIndex?: number;
    /**
     * The index of the set that should be selected by default.
     */
    selectedIndex?: number;
}

/**
 * Parameters used by the stats server.
 */
export type StatsQueryParams = BaseQueryParams & {
    /**
     * A full URL to a sheet or set. If provided, it will be parsed for page, onlySetIndex, and selectedIndex. These can still be overridden by providing the specific parameters directly.
     */
    url?: string;
}

/**
 * Parameters used by the preview server.
 */
export type PreviewQueryParams = BaseQueryParams & {
    /**
     * Internal parameter used to force a refresh of the cached data.
     */
    _cacheBust?: string;
}

export type EmbedCheckQuery = StatsQueryParams

export type BaseDataQuery = StatsQueryParams & {
    /**
     * If true, and the result would normally be a single set, it will be wrapped in a sheet export instead.
     */
    exportAsSheet?: boolean;
}

export type ImportExportSheetQuery = {
    /**
     * Override the party bonus (0-5) for the calculation.
     */
    partyBonus?: number | string;
} & BaseQueryParams;

export type FullDataQuery = StatsQueryParams & ImportExportSheetQuery;

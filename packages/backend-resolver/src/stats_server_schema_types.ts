import {SetExportExternalSingle, SheetExport, SheetStatsExport} from "@xivgear/xivmath/geartypes";

export type EmbedCheckResponse = {
    isValid: true,
} | {
    isValid: false,
    reason: string,
}

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

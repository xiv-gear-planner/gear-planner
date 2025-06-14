export function getNextSheetInternalName() {
    const lastRaw = localStorage.getItem("last-sheet-number");
    const lastSheetNum = lastRaw ? parseInt(lastRaw) : 0;
    const next = lastSheetNum + 1;
    localStorage.setItem("last-sheet-number", next.toString());
    const randomStub = Math.floor(Math.random() * 16384 * 65536);
    return "sheet-save-" + next + '-' + randomStub.toString(16).toLowerCase();
}
export function deleteSheetByKey(saveKey: string) {
    localStorage.removeItem(saveKey);
}

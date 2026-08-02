import './advancedsearch';
import './item-detail-layout';
import './ads';
import './components/stat_display';
import {applyCommonTopMenuFormatting} from "@xivgear/common-ui/components/top_menu";

function formatTopMenu() {
    const topMenuArea = document.getElementById("main-menu-area")
    topMenuArea?.querySelectorAll('a').forEach(link => {
        applyCommonTopMenuFormatting(link);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    formatTopMenu();
});

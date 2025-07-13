import { RoundWidget, MatchWidget } from "./widget.js";
class GlobalVariables{
    selectedConnector = undefined;
    advacingMatch = undefined;
    draggedMatch = undefined;
    selectedMatch = undefined; //will be a map/array in the future, supporting selection of multiple matches
    roundWidget = new RoundWidget(document.getElementById("round_edit_widget_popover"));
    matchWidget = new MatchWidget(document.getElementById("match_edit_widget_popover"));
    lastConnectorIdNumber = 1;

}

export const global = new GlobalVariables();
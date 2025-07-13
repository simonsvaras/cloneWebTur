import { RoundWidget, MatchWidget } from "./widget.js";
class GlobalVariables{
    selectedConnector = undefined;
    advacingMatch = undefined;
    draggedMatch = undefined;
    selectedMatch = undefined; //will be a map/array in the future, supporting selection of multiple matches
    roundWidget = new RoundWidget(document.getElementById("round_edit_widget_popover"));
    matchWidget = new MatchWidget(document.getElementById("match_edit_widget_popover"));
    lastConnectorIdNumber = 1;
    resizingSection = undefined; //reference to the section object /section element currently being resized
    lastMouseX = undefined;
    lastMouseY = undefined;
    zoomLevel = 1.0;

}

export const global = new GlobalVariables();
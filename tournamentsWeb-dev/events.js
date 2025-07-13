import * as t from "./tournaments.js";
import {undo} from "./history.js";

/*In this file we register all global events that exist when the page is loaded and are not owned by any objects*/
export function registerGlobalEvents(){
    document.getElementById("add_matches_button").addEventListener("click", t.addMatches);
    document.getElementById("section_add_popup").addEventListener("click", ()=>t.add_section(undefined, null, true));
    document.getElementById("general_action_undo").addEventListener("click", ()=>undo("backwards"));
    document.getElementById("general_action_redo").addEventListener("click", ()=>undo("forwards"));
    document.getElementById("general_action_zoom_in").addEventListener("click", ()=>t.zoomIn());
    document.getElementById("general_action_zoom_out").addEventListener("click", ()=>t.zoomOut());
}

export function removeContextMenu() {
    if(document.getElementsByClassName("contextMenu").length > 0)
        document.getElementsByClassName("contextMenu")[0].remove();
}
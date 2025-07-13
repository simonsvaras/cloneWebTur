import * as t from "./tournaments.js";

/*In this file we register all global events that exist when the page is loaded and are not owned by any objects*/
export function registerGlobalEvents(){
    document.getElementById("add_matches_button").addEventListener("click", t.addMatches);
    document.getElementById("section_add_popup").addEventListener("click", ()=>t.add_section(undefined, null, true));
}

export function removeContextMenu() {
    if(document.getElementsByClassName("contextMenu").length > 0)
        document.getElementsByClassName("contextMenu")[0].remove();
}
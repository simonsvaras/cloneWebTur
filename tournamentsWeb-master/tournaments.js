import * as CONSTANT from "./constants.js";
import * as GlobalEvents from "./events.js";
import {Team} from "./team.js"
import { Connector, modifyLine, draggedConnector, dropConnector} from "./connector.js";
import { global } from "./global.js";
import { getMatchPosition, setMatchPosition } from "./match.js";
import { historyStack, forwardStack, undo, pushHistoryObject, discardHistory, latestHistoryChange } from "./history.js";
import { Match } from "./match.js";
import { Round } from "./round.js";
import { Section, snapModeChange } from "./section.js";


export let matchesPositions = new Map();

// All elements in shrinkeble
const shrinkableElements = document.querySelectorAll('.widget_select_scrollable .shrinkable');

// Pole threshold hodnot od 0 do 1 (krok po 0.01)
const thresholds = Array.from({length: 101}, (_, i) => i / 100);

// Vytvoření IntersectionObserveru s nastaveným rootMargin
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        const ratio = entry.intersectionRatio;
        let scale;
        if (ratio >= 1) {
            scale = 1;
        } else {
            scale = Math.max(0.6, ratio);
        }
        entry.target.style.transform = `scale(${scale})`;
    });
}, {
    threshold: thresholds,
    // Posun dolní hranice o 50px nahoru
    rootMargin: "0px 0px -50px 0px" // tohle podle mě nic nedělá. Odstranit?
});

shrinkableElements.forEach(el => observer.observe(el));


function processMouseUp(event){
    if(global.draggedMatch){
        dropMatch(event);
        return;
    }
    else if(draggedConnector.isActive()){
        
        if(!draggedConnector.snapped)
            dropConnector(event);
        else{
            console.log(draggedConnector.connector.right);
            //draggedConnector.connector.highlightCollisions();
            //draggedConnector = undefined; //we set all the data when we snapped the connector so we just unset it here
            draggedConnector.deactivate()
            if(latestHistoryChange !== null)
                pushHistoryObject();
        } 
        matchesPositions.get(getMatchPosition(draggedConnector.match.matchElement).sectionName).highlightCollisions();
        return;
    }
}



function processMouseDown(event){
    if(global.selectedMatch && event.target.closest(".match") !== global.selectedMatch.matchElement){
        global.selectedMatch.deselect();
    }
    if(global.selectedConnector && ![global.selectedConnector.line, global.selectedConnector.linePart2].includes(event.target)){
        global.selectedConnector.deselect();
    }
    GlobalEvents.removeContextMenu();
}

function processClick(event){
    console.log("click");
    if(global.advacingMatch){
        //clicked outside of a match, canceling action
        if(global.advacingMatch.promotion){
            global.advacingMatch.from.rightConnector.reset(true);
        }
        else if(global.advacingMatch.from.rightRelegationConnector){
            global.advacingMatch.from.rightRelegationConnector.reset(true);
        }
        cancelSelectAdvancing();
    }
    //tady je vsechno pres mouse up a down eventy, click zatim nepotrebny
}

function processKeyPress(event){
    console.log("keydown", event)
    //document.addEventListener('keyup', (event) => {
    if (event.keyCode === 46 && global.selectedMatch){//delete key
        global.selectedMatch.delete(true);
    }
    else if (event.keyCode === 46 && global.selectedConnector){
        global.selectedConnector.delete(true);
    }
    else if(event.ctrlKey && event.keyCode === 90 && !global.roundWidget.isOpened() && !global.matchWidget.isOpened()){// alt + z
        event.preventDefault();
        undo("backwards");
        console.log(event);
    }
    else if(event.ctrlKey && event.keyCode === 89 && !global.roundWidget.isOpened() && !global.matchWidget.isOpened()){// alt + y
        event.preventDefault();
        undo("forwards");
        console.log(event);
    }
   // });
}





function dropMatch(event){
    console.log("MATCH DROPPED");
    //setMatchPosition(global.draggedMatch, getMatchPosition(global.draggedMatch).roundIndex, parseInt(global.draggedMatch.style.top, 10));
    if(latestHistoryChange.from === parseFloat(global.draggedMatch.style.top)){
        discardHistory();
    }
    else{
        const positions = getMatchPosition(global.draggedMatch);
        latestHistoryChange.to = parseFloat(global.draggedMatch.style.top);
        latestHistoryChange.target = matchesPositions.get(positions.sectionName).get(positions.roundIndex).getMatch(positions.matchOffset).getHistoryName();
        pushHistoryObject();
        matchesPositions.get(positions.sectionName).highlightCollisions();
    }
    global.draggedMatch = undefined;
    //dragActiveMatchesGrid = undefined;
}


window.addEventListener("mouseup", processMouseUp);
window.addEventListener("mousedown", processMouseDown);
window.addEventListener("click", processClick);
window.addEventListener("keydown", processKeyPress);


function initializeMatchesPositions(){
    if(loadTournamentFromLocalStorage())//!!!EXPERIMENTAL!!!
        return;
    const sections = document.querySelectorAll(".matches");
    for(const[indexSection,section] of sections.entries()){
        const rounds = section.querySelectorAll(".round_column");
        const sectionName = section.parentElement.parentElement.querySelector(".section_name").value;
        matchesPositions.set(sectionName, new Section(sectionName, section.parentElement.parentElement, indexSection));
        for(const [indexRound, round] of rounds.entries()){
            //tohle je do budoucna lepsi udelat JS only a nemazat se se stavajicim HTML, proste to tam placnout touhle funkci
            const roundName = document.querySelector(`.tournament_subdivision[data-sectionName="${sectionName}"] .tournament_legend .rounds_settings div:nth-child(${indexRound+1}) .legend_round_name`);
            if(getColumnSnappingMode(sectionName, indexRound) !== "Free"){
                matchesPositions.get(sectionName).set(indexRound,new Round(indexRound, round, 200 , roundName.value, getColumnSnappingMode(sectionName, indexRound)));
            }
            else{
                matchesPositions.get(sectionName).set(indexRound,new Round(indexRound, round, 0 , roundName.value, getColumnSnappingMode(sectionName, indexRound)));
            }
            
            //roundName.addEventListener("change", roundNameChange);
            document.querySelector(`.tournament_subdivision[data-sectionName="${sectionName}"] .tournament_legend .rounds_settings div:nth-child(${indexRound+1}) .round_grid_snap`).addEventListener("change", snapModeChange);             

            const matches = round.querySelectorAll(".match");
            let offset = 0;
            for(let i = 0; i< matches.length; i++){
                console.log("match", i);
                matchesPositions.get(sectionName).get(indexRound).addMatch(offset, new Match(matches[i]));
                matches[i].style.top = offset + "px";
                offset += 200;
            }
        }
    }
}






export function getColumnSnappingMode(sectionName, columnIndex){
    return document.querySelector(`.tournament_subdivision[data-sectionName="${sectionName}"] .tournament_legend .rounds_settings div[data-round='${(columnIndex+1)}'] .round_grid_snap`).value;
}



function listSections(){
    return matchesPositions.keys();
}        

export function updateSectionsList(){
    const oldSelectedVal = document.querySelector(`#add_match_section`).value;
    document.querySelector(`#add_match_section`).replaceChildren();

    for(let section of document.querySelectorAll(".tournament_subdivision")){
        const select = document.querySelector(`#add_match_section`);
        const option = document.createElement("option");
        option.textContent = section.dataset.sectionname;
        option.value = section.dataset.sectionname;
        if(option.value === oldSelectedVal){
            option.selected = true;
        }
        select.appendChild(option);
    }
    updateRoundList(document.querySelector(`#add_match_section`).value);
}



export function updateRoundList(sectionName){
    if(!sectionName){
        return;
    }
    console.log("updating rounds for section", sectionName);
    const select = document.querySelector("#add_match_round");
    const options = [];
    for(let i = 1; i<= matchesPositions.get(sectionName).count(); i++){ //JMENA JSOU TADY STATICKY PROTOZE JSOU TO KLICE V MAPE!!!
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        if(i == select.value)
            opt.selected = true;
        options.push(opt);
    }
    console.log(options);
    select.replaceChildren(...options);
    
}


export function addMatches(){
    const count = document.getElementById("matches_number").value;
    const round = document.getElementById("add_match_round").value;
    const sectionName = document.getElementById("add_match_section").value;
    console.log(count, round, sectionName);
    if(isNaN(parseInt(count)) || round === "" || sectionName === "")
        return;
    
    latestHistoryChange.viewportHeight = matchesPositions.get(sectionName).get(round-1).element.closest("section.matches").offsetHeight;
    let lastOffset = 0;
    //pro historii: muzeme si udelat array last offsetu, a podle toho je pak zpatky pridat

    const matchesArray = []
    for(let i = 0; i< count; i++){
        lastOffset = matchesPositions.get(sectionName).get(round-1).createMatch();
        matchesArray.push([lastOffset, matchesPositions.get(sectionName).get(round-1).getMatch(lastOffset).matchId]);
        console.log("match added");
    }
    
    adjustSectionCanvasHeight(sectionName, lastOffset);

    latestHistoryChange.type = "add_matches";
    latestHistoryChange.section = sectionName;
    latestHistoryChange.roundIndex = parseInt(round) - 1;
    latestHistoryChange.target = matchesArray;

    pushHistoryObject();

    
}
export function addMatchToRound(sectionName, roundIndex){
    latestHistoryChange.viewportHeight = matchesPositions.get(sectionName).get(roundIndex).element.closest("section.matches").offsetHeight;
    const lastOffset = matchesPositions.get(sectionName).get(roundIndex).createMatch();
    adjustSectionCanvasHeight(sectionName, lastOffset);
    latestHistoryChange.type = "add_matches";
    latestHistoryChange.section = sectionName;
    latestHistoryChange.roundIndex = roundIndex;
    latestHistoryChange.target = [[lastOffset, matchesPositions.get(sectionName).get(roundIndex).getMatch(lastOffset).matchId]];
    pushHistoryObject();
}


export function adjustSectionCanvasHeight(sectionName, lastAddedMatchOffset, shrinkingAllowed = false){
    const section = document.querySelector(`.tournament_subdivision[data-sectionName='${sectionName}']`);
    console.log(section, sectionName);
    const grid = section.querySelector(".grid");
    const connectorGrid = section.querySelector(".connectorGrid");
    const matches = section.querySelector(".matches");
    const maxMatchOffset = matchesPositions.get(sectionName).maxMatchOffset();
    console.log("AdjustCanvas height before", parseFloat(matches.getBoundingClientRect().height, 10,), "new offset", lastAddedMatchOffset, "max offset",  maxMatchOffset);

    if(!shrinkingAllowed && parseFloat(matches.getBoundingClientRect().height, 10) >= lastAddedMatchOffset + 150){
        return;
    }
    matches.style.height = maxMatchOffset +200 -20 + "px";//-20 compenstates for .matches padding-top
    grid.style.height = maxMatchOffset +200 + "px";
    connectorGrid.style.height = maxMatchOffset +200 + "px";

}


initializeMatchesPositions();

let JSONdata = {};
function generateJSON(save = true){ //EXPERIMENTAL!!!
    JSONdata = {
        sections: {},
        history: historyStack.stack,
        forwardHistory: forwardStack.stack
    };
    const loopedMatches = new Set();
    const loopedConnectors = new Set();
    for(const [sectionName, section] of matchesPositions){
        ///const section = JSONworkingMap.get(key);
        JSONdata["sections"][sectionName] = {};
        JSONdata["sections"][sectionName]["rounds"] = {};
        JSONdata["sections"][sectionName]["settings"] = section.settings;
        for(const [roundNumber, round] of section.rounds){
            JSONdata["sections"][sectionName]["rounds"][roundNumber] = {};
            JSONdata["sections"][sectionName]["rounds"][roundNumber]["settings"] = round.getSettings();
            JSONdata["sections"][sectionName]["rounds"][roundNumber]["matches"] = {};
            for(const [matchOffset, match] of round.matches){
                //loopedMatches.add(match);
                JSONdata["sections"][sectionName]["rounds"][roundNumber]["matches"][matchOffset] = {};
                JSONdata["sections"][sectionName]["rounds"][roundNumber]["matches"][matchOffset]["RightConnector"] = {};
                JSONdata["sections"][sectionName]["rounds"][roundNumber]["matches"][matchOffset]["RightConnector"]["generatedId"] = match.rightConnector.generatedId;
                JSONdata["sections"][sectionName]["rounds"][roundNumber]["matches"][matchOffset]["settings"] = match.getSettings().serialize();
                console.log(JSONdata["sections"][sectionName]["rounds"][roundNumber]["matches"][matchOffset]["settings"]);
                if(match.rightConnector.right){
                    const positions = match.rightConnector.right.getPosition();
                    JSONdata["sections"][sectionName]["rounds"][roundNumber]["matches"][matchOffset]["RightConnector"]["connectedTo"] = positions.sectionName + "_" + positions.roundIndex + "_" + positions.matchOffset + "_" + match.rightConnector.leftPositionString();;
                }
                if(match.rightRelegationConnector){
                    JSONdata["sections"][sectionName]["rounds"][roundNumber]["matches"][matchOffset]["RightRelegationConnector"] = {};
                    if(match.rightRelegationConnector.right){
                        const positions = match.rightRelegationConnector.right.getPosition();
                        JSONdata["sections"][sectionName]["rounds"][roundNumber]["matches"][matchOffset]["RightRelegationConnector"]["connectedTo"] = positions.sectionName + "_" + positions.roundIndex + "_" + positions.matchOffset + "_" + match.rightRelegationConnector.leftPositionString();;
                    }
                }
            }
        }
    }
    //localStorage.removeItem()
    console.log(JSONdata);
    if(save)
        localStorage.setItem("savedPositions", JSON.stringify(JSONdata));
    return JSONdata;
}

function loadTournamentFromLocalStorage(){ //EXPERIMENTAL!!!
    if(!localStorage.getItem("savedPositions"))
        return false;
    const storedJson = localStorage.getItem("savedPositions");
    const parsed = JSON.parse(storedJson);
    matchesPositions = new Map();
    global.lastConnectorIdNumber = 1;
    
    //remove old HTML
    document.querySelector(".tournament_subdivision").remove();
    for(const sectionName in parsed["sections"]){
        const sectionElement = add_section(sectionName, parsed["sections"][sectionName]["settings"].order).element;
        //remove addRoundListener and put the element back in
        /*var old_element = sectionElement.querySelector(".add_round_button");
        var new_element = old_element.cloneNode(true);
        old_element.parentNode.replaceChild(new_element, old_element);*/

        //matchesPositions.set(sectionName, new Section(sectionName, sectionElement, parsed["sections"][sectionName]["settings"].order));
        console.log(parsed["sections"][sectionName]);
        let lastOffset = 0;
        for(const roundIndex in parsed["sections"][sectionName].rounds){
            //roundIndex = Number(roundIndex);
            const RI = Number(roundIndex);//string from json, need int internally
            console.log(roundIndex);
            const settings = parsed["sections"][sectionName].rounds[roundIndex].settings;
            console.log(settings);
            matchesPositions.get(sectionName).createNewRound();
            console.log(RI, matchesPositions.get(sectionName), matchesPositions.get(sectionName).get(RI));
            //matchesPositions.get(sectionName).setRoundName(RI, settings.name);
            matchesPositions.get(sectionName).get(RI).getSettings().setSettings(settings.name, settings.startTime, settings.format, false, sectionName+"_"+roundIndex, settings.snappingMode, settings.snappingOffset);
            sectionElement.querySelector(`.tournament_legend .rounds_settings div[data-round='${RI+1}'] .legend_round_name`).value = settings.name;

            for(const matchOffset in parsed["sections"][sectionName].rounds[roundIndex].matches){
                const MO = Number(matchOffset);
                const matchSettings = parsed["sections"][sectionName].rounds[roundIndex]["matches"][matchOffset]["settings"];
                console.log(matchSettings);
                lastOffset = matchesPositions.get(sectionName).get(RI).createMatch(MO);
                const match = matchesPositions.get(sectionName).get(RI).getMatch(MO);
                let team1 = Match.getConstantTeamReferenceFromString(matchSettings.team1);
                let team2 = Match.getConstantTeamReferenceFromString(matchSettings.team2);
                match.getSettings().setSettings(matchSettings.startTime, matchSettings.format, false, match.getHistoryName(), team1, team2); // tymy s konektory resime az pri pripojovani konektoru
                match.updateTeams(); //updatuje jen tento zapas samotny. Nepropaguje se dal, jelikoz zadne konektory jeste nejsou pripojene
                //todo: 13.2.2025 ukladat i match settings, ktery zde nacteme.
            }
            adjustSectionCanvasHeight(sectionName, lastOffset);
            //all matches are loaded
        }
    }
    //connect their connectors
    for(const sectionName in parsed["sections"]){
        for(const roundIndex in parsed["sections"][sectionName].rounds){
            const RI = Number(roundIndex);//string from json, need int internally
            for(const matchOffset in parsed["sections"][sectionName].rounds[roundIndex].matches){
                const MO = Number(matchOffset);
                const rightConnectorTarget = parsed["sections"][sectionName].rounds[roundIndex].matches[MO]["RightConnector"];
                const rightRelegationConnector = parsed["sections"][sectionName].rounds[roundIndex].matches[MO]["RightRelegationConnector"];
                //const leftConnectorsTargetsMap = parsed["sections"][sectionName].rounds[roundIndex].matches[MO]["LeftConnectors"];
                console.log(parsed["sections"][sectionName].rounds[roundIndex].matches[MO], rightConnectorTarget,  rightConnectorTarget.connectedTo);

                if(rightConnectorTarget["connectedTo"]){
                    const rightSplitString = rightConnectorTarget["connectedTo"].split("_");
                    const rightTargetMatch = matchesPositions.get(rightSplitString[0]).get(Number(rightSplitString[1])).getMatch(Number(rightSplitString[2]));
                    const connector = matchesPositions.get(sectionName).get(RI).getMatch(MO).rightConnector;
                    console.log(rightTargetMatch);
                    console.log(matchesPositions.get(sectionName).get(RI));
                    connector.setRightMatch(rightTargetMatch);
                    rightTargetMatch.leftConnectors.set(rightSplitString[3], connector);
                    if(rightSplitString[0] !== sectionName)
                        connector.setExternal(true);
                    connector.recalculate(true, false);
                    if(rightSplitString[3] === "upper"){
                        rightTargetMatch.setTeam1(connector);
                    }
                    else if(rightSplitString[3] === "lower"){
                        rightTargetMatch.setTeam2(connector);
                    }
                    connector.left.getRightConnectingDotElement().style.display = "block";
                    connector.right.getLeftConnectingDotElement(rightSplitString[3]).style.display = "block";
                }
                if(rightRelegationConnector){
                    matchesPositions.get(sectionName).get(RI).getMatch(MO).enableRelegation();
                    if(rightRelegationConnector["connectedTo"]){
                        const rightSplitString = rightRelegationConnector["connectedTo"].split("_");
                        const rightTargetMatch = matchesPositions.get(rightSplitString[0]).get(Number(rightSplitString[1])).getMatch(Number(rightSplitString[2]));
                        const connector = matchesPositions.get(sectionName).get(RI).getMatch(MO).rightRelegationConnector;
                        connector.setRightMatch(rightTargetMatch);
                        rightTargetMatch.leftConnectors.set(rightSplitString[3], connector);
                        if(rightSplitString[0] !== sectionName)
                            connector.setExternal(true);
                        connector.recalculate(true, true);
                        if(rightSplitString[3] === "upper"){
                            rightTargetMatch.setTeam1(connector);
                        }
                        else if(rightSplitString[3] === "lower"){
                            rightTargetMatch.setTeam2(connector);
                        }
                        connector.left.getRightRelegationConnectingDotElement().style.display = "block";
                        connector.right.getLeftConnectingDotElement(rightSplitString[3]).style.display = "block";
                    }
                }
            }
        }
    }
    historyStack.loadStack(parsed["history"]);
    forwardStack.loadStack(parsed["forwardHistory"]);
    return true;

}





export function add_section(name = undefined, positionIndex = null, history = false){
    if(name === undefined){
        for(let i = 1; i<16; i++){
            name = "New section " + i;
            if(!matchesPositions.has(name)){
                break;
            }
            if(i === 16){
                alert("Section could not be added. Please clean up your tournament");
                return;
            }
        }
    }
    const html = document.getElementById("section_template").content.cloneNode(true).firstElementChild;
    html.dataset.sectionname = name;
    html.querySelector(".section_name").value = name;
    let node;
    console.log("idgf2", positionIndex, document.getElementsByClassName("tournament_subdivision").length)
    if(positionIndex === null || positionIndex < 0 || positionIndex >= document.getElementsByClassName("tournament_subdivision").length){
        positionIndex = document.getElementsByClassName("tournament_subdivision").length;
        node = document.getElementById("tournament_container").appendChild(html);
    }
    else{
        console.log("idgf", positionIndex, document.getElementsByClassName("tournament_subdivision")[positionIndex]);
        node = document.getElementsByClassName("tournament_subdivision")[positionIndex].insertAdjacentElement("beforebegin", html);
    }

    const section = new Section(name, node, positionIndex);
    matchesPositions.set(name, section);
    updateSectionsList();

    if(history){
        latestHistoryChange.type = "add_section";
        latestHistoryChange.section = name;
        latestHistoryChange.settings = section.settings;
        pushHistoryObject();
    }

    return section;
}

/*function selected_section_change(event){
    updateRoundList(event.target.value);
}*/

export function closestNumber(base, factor, value) { //Thanks ChatGPT - you stole the code anyway
    console.log("closestNumber params", base, factor, value);
    if (value <= base) {
        console.log("closestNumber returns", base);
        return base;
    }
    
    const difference = value - base;
    const multiplier = Math.floor(difference / factor);
    const closest = base + multiplier * factor;
    
    // Check which of the closest numbers (current or next) is closer to the value
    const nextClosest = base + (multiplier + 1) * factor;
    if (Math.abs(value - nextClosest) < Math.abs(value - closest)) {
        return nextClosest;
    }
    console.log("closestNumber returns", closest);
    return closest;
}







/*TESTING PLAYGROUND*/
//matchesPositions.get("Section1").get(0).getMatch(0).rightConnector.external = true;




export function teamWidgetSelectTeam(match, teamId, element, team){
    console.log(element, teamId, team);
    if(element.closest(".widget_select_scrollable").querySelector(".team_selected")){
        element.closest(".widget_select_scrollable").querySelector(".team_selected").classList.remove("team_selected");
    }
    const row = element.closest("div").classList.add("team_selected");
    let teamReference;
    if(teamId === "Random")
        teamReference = "Random";
    else if(teamId === "TBD")
        teamReference = "TBD";
    else{
        teamReference = CONSTANT.registeredTeams.get(teamId);
    }
    /*switch(team){
        case 1:
            match.setTeam1(teamReference);
            console.log(match);
            break;
        case 2:
            match.setTeam2(teamReference);
            console.log(match);
            break;

    }*/
}

export function select_advancing_team(event, promotion){
    event.stopPropagation();
    const match = global.matchWidget.match;
    const positions = match.getPosition();
    const disabledColumns = document.querySelectorAll(`.tournament_subdivision[data-sectionName="${positions.sectionName}"] .matches> :nth-child(n+1):nth-child(-n+${positions.roundIndex+1})`)
    disabledColumns.forEach((element)=>element.classList.add("selecting_not_allowed"));
    if(match.rightConnector.right)
        match.rightConnector.right.matchElement.classList.add("selecting_not_allowed");
    
    if(match.rightRelegationConnector && match.rightRelegationConnector.right)
        match.rightRelegationConnector.right.matchElement.classList.add("selecting_not_allowed")
    //nesmime povolit relagation/promotion ve STEJNE SEKCI DO STEJNEHO NEBO PREDCHAZEJICIHO KOLA
    global.matchWidget.close();

    global.advacingMatch = {
        from: match,
        promotion: promotion
    }
    document.querySelector("#tournament_container").classList.add("selecting_advacing_team");
}

export function cancelSelectAdvancing(){
    global.advacingMatch = undefined;
    document.querySelector("#tournament_container").classList.remove("selecting_advacing_team");
    document.querySelectorAll(".selecting_not_allowed").forEach((element) => element.classList.remove("selecting_not_allowed"));
}
//console.log(matchesPositions.get("Section1").get(0).getMatch(0).rightConnector.externalConnectorHTML());

//document.getElementById("match_edit_widget_close").addEventListener("click", ()=>document.getElementById("match_edit_widget_popover").hidePopover());
//document.getElementById("round_edit_widget_close").addEventListener("click", ()=>document.getElementById("round_edit_widget_popover").hidePopover());
document.getElementById("edit_time_prompt").addEventListener("click", ()=>document.getElementById("round_edit_widget_start_time").showPicker());
document.querySelector("#add_match_section").addEventListener("change", (event)=> updateRoundList(event.target.value));

//document.getElementById("round_edit_widget_start_time").addEventListener("change", (event) => updateRoundWidgetStartTime(event.target.value));
//document.getElementById("round_edit_widget_popover").addEventListener("beforetoggle", closeRoundEditPopover);


document.querySelectorAll('#match_edit_widget_start_container input[name="match_edit_widget_start_select"]').forEach((element) =>{
    console.log("attepmting to register listener", element);
    const clickHandler = function(){
    if(this.id === "match_edit_widget_start_select_fixed")
        document.querySelector("#match_edit_widget_start_container #match_edit_widget_start_time").disabled = false;
    else
        document.querySelector("#match_edit_widget_start_container #match_edit_widget_start_time").disabled = true;
    }

    element.addEventListener("change", clickHandler);
    
});

GlobalEvents.registerGlobalEvents();
window.matchesPositions = matchesPositions;
window.registeredTeams =  CONSTANT.registeredTeams;
window.historyStack = historyStack;

window.draggedConnector = draggedConnector;
window.global = global;
window.generateJSON = generateJSON;
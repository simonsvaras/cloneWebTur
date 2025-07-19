//set pridame pak i match tridu
import { matchesPositions, cancelSelectAdvancing } from "./tournaments.js";
import { Connector, draggedConnector, modifyLine } from "./connector.js";
import { global } from "./global.js";
import * as GlobalEvents from "./events.js";
import { snapLeftConnector, snapRightConnector } from "./connector.js";
import { pushHistoryObject, discardHistory, latestHistoryChange, decodeConnector } from "./history.js";
import * as CONSTANT from "./constants.js";
import { Team } from "./team.js";

let lastMatchIdNumber = 1;

class LeftConnectorManager {
    constructor() {
        this.upper = undefined;
        this.lower = undefined;
    }

    // Implement Map-like interface
    set(position, connector) {

        if(connector && position === "upper"){
            this.upper = connector;
        }
        else if(connector && position === "lower"){
            this.lower = connector;
        }
        console.log("LeftConnectorManager set", connector, position, connector.isLeftUpper(), connector.isLeftLower());
    }

    get(key) { //key is the connector's id
        console.log(this);
        if(this.upper && this.upper.generatedId === key)
            return this.upper;
        else if(this.lower && this.lower.generatedId === key)
            return this.lower;
        return undefined;
    }

    has(key) {
        return !!this.get(key);
    }

    delete(key) {
        if(this.upper && this.upper.generatedId === key)
            this.upper = undefined;
        else if(this.lower && this.lower.generatedId === key)
            this.lower = undefined;
    }

    get size() {
        return (this.upper ? 1 : 0) + (this.lower ? 1 : 0);
    }

    // Implement iterable protocol
    *[Symbol.iterator]() {
        if (this.upper) yield ['upper', this.upper];
        if (this.lower) yield ['lower', this.lower];
    }

    // Optional: Implement iteration
    *entries() {
        yield* this[Symbol.iterator]();
    }

    *values() {
        if (this.upper) yield this.upper;
        if (this.lower) yield this.lower;
    }

    *keys() {
        if (this.upper) yield 'upper';
        if (this.lower) yield 'lower';
    }
}

class MatchSettings{
    constructor(matchReference, startTime = undefined, format = undefined){
        this._startTime = startTime;
        this._format = format;
        this.team1ToDo = "Random"; // tohle predelat tak, aby to prevzalo veci z match.team1, ktere eventuelne odstranime
        this.team2ToDo = "Random"; //can be "TBD", "Random" , Team reference or connector Reference
        this.match = matchReference;
    }

    get format(){
        if(!this._format){
            return this.match.getRound().getSettings().format;
        }
        return this._format;
    }
    set format(f){
        this._format = f;
    }
    get startTime(){
        if(!this._startTime){
            return this.match.getRound().getSettings().startTime;
        }
        return this._startTime;
    }
    set startTime(st){
        this._startTime = st;
    }

    get team1(){
        return this.team1ToDo;
    }

    get team2(){
        return this.team2ToDo;
    }


    setTeam1(team){
        this.team1ToDo = MatchSettings.getTeamReference(team);
        console.log("setTeam1 result ", this.team1);
    }
    setTeam2(team){
        this.team2ToDo = MatchSettings.getTeamReference(team);;
        console.log("setTeam2 result ", this.team2);
    }

    /*
        Returns team object for valid team ids, "TBD" or "random" for tbd and random, undefinied for invalid team Ids
     */
    static getTeamReference(team){
        console.log("getTeamReference of ", team);
        if(team instanceof Team)
            return team; //Team instance
        if(!(team instanceof Connector) && !["TBD", "Random"].includes(team))
            return Team.getTeamById(team);//is teamId here
        else
            return team; // connector or "TBD"/"Random"
    }

    setSettings(startTime = undefined, format = undefined, history = false, identifier = false, team1 = undefined, team2 = undefined){
        if(history){
            latestHistoryChange.type = "match_settings_change";
            latestHistoryChange.target = identifier;
            latestHistoryChange.startTime = this._startTime; //we actually need undefined here if no startTime is defined
            latestHistoryChange.format = this._format;
            latestHistoryChange.newStartTime = startTime? startTime : this._startTime;
            latestHistoryChange.newFormat = format? format : this._format;
            latestHistoryChange.team1 = Match.getTeamReferenceId(this.team1);
            latestHistoryChange.newTeam1 = team1? Match.getTeamReferenceId(team1) : Match.getTeamReferenceId(this.team1);
            latestHistoryChange.team2 = Match.getTeamReferenceId(this.team2);
            latestHistoryChange.newTeam2 = team2? Match.getTeamReferenceId(team2) : Match.getTeamReferenceId(this.team2);
            console.log("pushing match setting to history:", latestHistoryChange);
            pushHistoryObject();
        }

        this._format = format; // can be set to undefinied to reflect its round settings
        this._startTime = startTime; // can be set to undefinied to reflect its round settings
        if(team1)
            this.setTeam1(team1);
        if(team2)
            this.setTeam2(team2);
    }

    serialize(){
        return {
            startTime: this._startTime,
            format: this._format,
            team1: Match.getTeamReferenceId(this.team1),
            team2: Match.getTeamReferenceId(this.team2)
        }
    }
}
export class Match {
    constructor(element, idOverride = undefined){
        this.matchId = idOverride? idOverride : lastMatchIdNumber++;
        this.matchElement = element; //HTML reference
        //this.leftConnectors = new Map(); // we only track right connectors, left ones are references to the right ones
        this._leftConnectors = new LeftConnectorManager();
        this.rightConnector = new Connector(undefined, this);  //every right connector must have a reference to their origin match
        console.log("created connector with left reference to", this);
        this.rightRelegationConnector = undefined;
        this.settings = new MatchSettings(this);

        element.addEventListener("click", function(event){this.clicked(event)}.bind(this));
        element.addEventListener("mouseover", function(event){processMouseOver(event)}.bind(this));
        element.querySelector("span.left_connecting_dot.upper").addEventListener("mousedown", function(event){this.leftDotDrag(event, "upper")}.bind(this));
        element.querySelector("span.left_connecting_dot.lower").addEventListener("mousedown", function(event){this.leftDotDrag(event, "lower")}.bind(this));
        element.querySelector("span.right_connecting_dot").addEventListener("mousedown", function(event){this.rightDotDrag(event)}.bind(this));
        element.addEventListener("mouseleave", function(event){this.clearSnapping(event)}.bind(this));
        element.addEventListener("mousedown", dragMatch);
        element.addEventListener("contextmenu", function(event){this.openContextMenu(event, true)}.bind(this));
        element.addEventListener("dblclick", function(){this.showMatchDetailsWidget()}.bind(this))
    }

    get leftConnectors() {
        return this._leftConnectors; // Exposes Map-like interface
    }

    clicked(event){
        if(global.advacingMatch){
            event.preventDefault();
            event.stopPropagation();
            if(this.matchElement.parentElement.classList.contains("selecting_not_allowed") || this.matchElement.classList.contains("selecting_not_allowed"))
                return;

            console.log(global.advacingMatch);
            this.selectAsAdvancing(event);
        }
        else{
            this.select(event);
        }
    }

    setRightConnector(connector){
        this.rightConnector = connector;
    }

    getPosition(){
        return getMatchPosition(this.matchElement);
    }

    getLeftConnectingDotElement(position){
        return this.matchElement.querySelector(`span.left_connecting_dot.${position}`);
    }
    getRightConnectingDotElement(){
        return this.matchElement.querySelector("span.right_connecting_dot");
    }
    getRightRelegationConnectingDotElement(){
        return this.rightConnector? this.matchElement.querySelector("span.relegation_connecting_dot") : undefined;
    }

    getRound(){
        const positions = this.getPosition();
        return matchesPositions.get(positions.sectionName).get(positions.roundIndex);
    }

    getSettings(){
        return this.settings;
    }

    canBeMovedToRound(roundIndex){ //nekde tady je chyba pri pretahovani kdyz je zapnuta relegace
        if((this.rightConnector.right && !this.rightConnector.external && roundIndex >= this.rightConnector.right.getPosition().roundIndex) ||
            (this.rightRelegationConnector && !this.rightRelegationConnector.external && this.rightRelegationConnector.right && roundIndex >= this.rightRelegationConnector.right.getPosition().roundIndex))
            return false;
        if([...this.leftConnectors.values()].some((x) => x.left.getPosition().roundIndex >= roundIndex && !x.external))
            return false;
        return true;
    }

    select(event){
        if(event)//can be called programatically from context menu
            event.stopPropagation();

        if(this.matchElement.classList.contains("match_selected") || global.advacingMatch !== undefined){
            return;
        }
        if(global.selectedMatch){
            global.selectedMatch.deselect();
        }
        const svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        const path = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
        path.setAttribute("x", "2px");
        path.setAttribute("y", "2px");
        path.setAttribute("rx", "10px");
        path.setAttribute("ry", "10px");

        svg.appendChild(path);
        this.matchElement.appendChild(svg);
        this.matchElement.classList.add("match_selected");
        global.selectedMatch = this;
    }

    deselect(){
        this.matchElement.classList.remove("match_selected");
        this.matchElement.querySelector("svg").remove();
        global.selectedMatch = undefined;
    }

    leftDotDrag(event, position){
        event.stopPropagation();
        if(event.buttons !== 1)//1 means left click
            return;
        console.log("left dot drag", global.selectedConnector, event);

        if(global.selectedConnector && global.selectedConnector.right === this){ //tohle je zase mozna spatne??
            if(global.selectedConnector.external)
                return;
            //modify existing left connector
            const leftMatchPositions = global.selectedConnector.left.getPosition();
            const startCoords = global.selectedConnector.getLeftLocalCoordinates();
            const endCoords = global.selectedConnector.getRightLocalCoordinates();
            const position = global.selectedConnector.leftPositionString();
            console.log(global.selectedConnector.generatedId, startCoords.x, startCoords.y, endCoords.x, endCoords.y);

            //dragActiveMatchesGrid = matchesPositions.get(this.getPosition().sectionName).getGrid();
            modifyLine(global.selectedConnector.generatedId, startCoords.x, startCoords.y, endCoords.x, endCoords.y);

            draggedConnector.setX(startCoords.x).setY(startCoords.y).setDirection("right").setSnapped(false).setMatchPositions(leftMatchPositions).setMatch(global.selectedConnector.left).setConnector(global.selectedConnector).activate();

            global.selectedConnector.toggleEvents(false);
            const generatedId = global.selectedConnector.generatedId;
            this.removeTeamByConnector(global.selectedConnector);
            global.selectedConnector.deselect();
            this.leftConnectors.get(generatedId).setRightMatch(undefined);
            this.leftConnectors.delete(generatedId);



            latestHistoryChange.type = "change_connector_left";
            latestHistoryChange.old = this.getHistoryName();
            latestHistoryChange.oldPosition = position;
            console.log("removed", generatedId, "from match",this.leftConnectors);
        }
        else{
            //drag left connector
            if(this.leftConnectors.size >= 2){
                console.log("Cannot drag more than two connectors from a match");
                return;
            }
            latestHistoryChange.source = this.getHistoryName();
            latestHistoryChange.type = "new_connector_left";
            //leftConnectorDrag(event, this.matchElement.querySelector("span.left_connecting_dot"));
            const tmpConnector = new Connector(undefined, undefined, this, false, "tmpConnector");
            tmpConnector.toggleEvents(false);
            this.leftConnectors.set(position, tmpConnector);
            this.leftConnectors.get(tmpConnector.generatedId).leftConnectorDrag();
        }
    }

    rightDotDrag(event, relegationConnector = false){
        event.stopPropagation();
        if(event.buttons !== 1)//1 means left click
            return;
        console.log("right dot drag", relegationConnector, global.selectedConnector && global.selectedConnector.left === this);

        if(global.selectedConnector && global.selectedConnector.left === this){ //tohle je mozna spatne?
            if(global.selectedConnector.external)
                return;
            //modify existing left connector
            const rightMatchPositions = global.selectedConnector.right.getPosition();
            const startCoords = global.selectedConnector.getRightLocalCoordinates();
            const endCoords = global.selectedConnector.getLeftLocalCoordinates();

            const connector = relegationConnector? this.rightRelegationConnector : this.rightConnector;

            //dragActiveMatchesGrid = matchesPositions.get(this.getPosition().sectionName).getGrid();
            modifyLine(global.selectedConnector.generatedId, startCoords.x, startCoords.y, endCoords.x, endCoords.y);
            const tmpConnector = new Connector(global.selectedConnector.line, undefined, global.selectedConnector.right, false, "tmpConnector");


            tmpConnector.toggleEvents(false);
            const generatedId = global.selectedConnector.generatedId;
            global.selectedConnector.deselect();

            //this.rightConnector.setLeftMatch(undefined);


            latestHistoryChange.type = "change_connector_right";
            latestHistoryChange.old = connector.getHistoryName();
            latestHistoryChange.source = connector.right.getHistoryName();
            latestHistoryChange.oldPosition = connector.leftPositionString();

            //console.log(global.selectedConnector.right.leftConnectors.upper);
            const position = connector.leftPositionString();

            connector.right.removeTeamByConnector(connector);
            connector.right.leftConnectors.delete(generatedId);

            //console.log(connector.right.leftConnectors.upper, position);
            connector.right.leftConnectors.set(position, tmpConnector);
            //console.log(tmpConnector.right.leftConnectors.upper);
            draggedConnector.setX(startCoords.x).setY(startCoords.y).setDirection("left").setSnapped(false).setMatchPositions(rightMatchPositions).setMatch(connector.right).setConnector(tmpConnector).activate();
            //console.log(draggedConnector);
            connector.setRightMatch(undefined);
            connector.setLine(undefined);
            tmpConnector.line.id = "tmpConnector";


            console.log("removed", generatedId, "from match", this.rightConnector);
        }
        else{
            //drag right connector
            const connector = relegationConnector? this.rightRelegationConnector : this.rightConnector;
            latestHistoryChange.source = connector.getHistoryName();
            latestHistoryChange.type = "new_connector_right";
            if(connector.external && connector.linePart2){
                connector.linePart2.parentElement.remove();
                connector.linePart2 = undefined;
            }
            connector.toggleEvents(false);
            connector.rightConnectorDrag(relegationConnector);
            //rightConnectorDrag(event, this.matchElement.querySelector("span.right_connecting_dot"));
        }
    }

    clearSnapping(event){
        if(!draggedConnector.isActive())
            return;
        console.log("clear snapping called on match", this, ", dragged connector is", draggedConnector.connector.generatedId, "direction:", draggedConnector.direction);

        if(draggedConnector.direction === "right"){
            for(let [id, lc] of this.leftConnectors){
                if(lc.generatedId === draggedConnector.connector.generatedId){
                    console.log("should clear snapping on the left connector");
                    lc.right.leftConnectors.delete(lc.generatedId);
                    lc.setRightMatch(undefined);
                    this.removeTeamByConnector(draggedConnector.connector);
                    draggedConnector.connector.toggleEvents(false);
                    draggedConnector.snapped = false;
                    return;
                }
            }

        }
        else if(draggedConnector.direction === "left"){
            console.log(draggedConnector.match === this.rightConnector.right, this.rightConnector.right);

            if(draggedConnector.match === this.rightConnector.right && draggedConnector.snapped){ //Zde musime zavest integritni omezeni ze winner a loser nemohou jit do stejneho zapasu, jinak se to rozbije!!
                console.log("should clear snapping on the right connector", draggedConnector);
                draggedConnector.connector.right.removeTeamByConnector(this.rightConnector);
                const lineCopy = this.rightConnector.refreshLineListeners(); //has a wanted side effect of cloning the node and creating new reference and returning it
                lineCopy.id = "tmpConnector";
                console.log(lineCopy, lineCopy.parentElement);
                const position = draggedConnector.connector.leftPositionString();

                draggedConnector.connector = new Connector(lineCopy, undefined, draggedConnector.match, false, "tmpConnector");
                draggedConnector.connector.right.leftConnectors.set(position, draggedConnector.connector)
                this.rightConnector.right.leftConnectors.set(position, draggedConnector.connector);
                this.rightConnector.reset(); //tady je problem, v tomhle se mi odstani i line
                draggedConnector.connector.toggleEvents(false);
                draggedConnector.snapped = false;
            }
            else if(this.rightRelegationConnector && draggedConnector.match === this.rightRelegationConnector.right && draggedConnector.snapped){
                console.log("should clear snapping on the right relegation connector", draggedConnector);
                draggedConnector.connector.right.removeTeamByConnector(this.rightRelegationConnector);
                const lineCopy = this.rightRelegationConnector.refreshLineListeners(); //has a wanted side effect of cloning the node and creating new reference and returning it
                lineCopy.id = "tmpConnector";
                console.log(lineCopy);
                const position = draggedConnector.connector.leftPositionString();
                draggedConnector.connector = new Connector(lineCopy, undefined, draggedConnector.match, false, "tmpConnector");
                //this.rightRelegationConnector.right.leftConnectors.delete(this.rightRelegationConnector.generatedId);
                this.rightRelegationConnector.right.leftConnectors.set(position , draggedConnector.connector);
                this.rightRelegationConnector.reset();
                draggedConnector.connector.toggleEvents(true);
                draggedConnector.snapped = false;
            }
        }
    }

    delete(history = false, overrideRoundIndex = null){
        console.log("deleting match", this, this.rightConnector);
        if(global.selectedMatch === this){
            this.deselect();
        }
        const positions = this.getPosition();

        const historyStepsIfNeeded = this.leftConnectors.size + (this.rightConnector.right === undefined? 0: 1) + (this.rightRelegationConnector? 1: 0); //we add connector deletions as separate steps so now we know how many more steps to process when recovering.
        const cachedHistoryName = this.getHistoryName(null, overrideRoundIndex, null);

        if(this.rightConnector.line)
            this.rightConnector.delete(history, overrideRoundIndex);
        if(this.rightRelegationConnector)
            this.rightRelegationConnector.delete(history, overrideRoundIndex);

        for(let [id, lc] of this.leftConnectors){
            lc.delete(history, overrideRoundIndex);
        }

        matchesPositions.get(positions.sectionName).get(positions.roundIndex).removeMatch(positions.matchOffset);
        this.matchElement.remove();

        if(history){
            latestHistoryChange.steps = historyStepsIfNeeded;
            latestHistoryChange.type = "delete_match";
            latestHistoryChange.target = cachedHistoryName;
            latestHistoryChange.viewportHeight = matchesPositions.get(positions.sectionName).element.querySelector(".viewport .matches").offsetHeight;
            latestHistoryChange.id = this.matchId;
            latestHistoryChange.settings = this.getSettings().serialize();
            pushHistoryObject();
        }
    }
    getHistoryName(overrideSectionName = null, overrideRoundIndex = null, overrideMatchOffset = null){
        const postitions = this.getPosition();
        const sn = overrideSectionName === null? postitions.sectionName : overrideSectionName;
        const ri = overrideSectionName === null? postitions.roundIndex : overrideRoundIndex;
        const mo = overrideSectionName === null? postitions.matchOffset : overrideMatchOffset;
        return sn + "_" + ri + "_" + mo;
    }

    recalculateConnectors(){
        this.recalculateRightConnectors();
        for(let lc of this.leftConnectors.values()){
            lc.recalculate();
        }
    }

    recalculateRightConnectors(){
        this.rightConnector.recalculate();
        if(this.rightRelegationConnector){
            console.log("if");
            this.rightRelegationConnector.recalculate(false, true);
        }
    }

    openContextMenu(event){
        if(global.advacingMatch !== undefined)
            return;

        event.preventDefault();
        event.stopPropagation();
        GlobalEvents.removeContextMenu();

        let contextMenuHtml;
        if(global.selectedMatch === this){
            console.log("context menu selected match");
            contextMenuHtml = document.getElementById("contextMenuSelectedMatchTemplate").content.cloneNode(true).firstElementChild;
        }
        else{
            console.log("context menu match");
            contextMenuHtml = document.getElementById("contextMenuMatchTemplate").content.cloneNode(true).firstElementChild;
        }
        const menu = document.body.appendChild(contextMenuHtml);
        console.log(menu);
        menu.style.left = (event.pageX - 10)+"px";
        menu.style.top = (event.pageY - 10)+"px";

        for(let li of menu.querySelectorAll("li")){
            console.log(li, li.onclick);

            const liActionString = li.dataset.action;
            li.addEventListener("mousedown", function(event){
                event.stopPropagation();
            });
            li.addEventListener("click", function(event){
                event.stopPropagation();
                event.preventDefault();
                const executable = new Function(liActionString).bind(this);
                console.log(this, executable, liActionString);
                executable();
                GlobalEvents.removeContextMenu();

            }.bind(this), true);
            console.log(li.onclick);
        }


    }

    enableRelegation(history = false){
        let multipleSteps = false; //for linking toggling the relegation and connecting the relegation connector in one undo action
        if(this.rightRelegationConnector){//relegation already enabled
            const relegationConnectorDot = this.matchElement.querySelector(".relegation_connecting_dot");
            this.rightRelegationConnector.delete(history);
            this.rightRelegationConnector = undefined;
            relegationConnectorDot.remove();
            this.matchElement.querySelectorAll(".right_connecting_dot")[0].style.top = null;
            this.recalculateRightConnectors();
            multipleSteps = true;
        }
        else{
            this.rightRelegationConnector = new Connector(undefined, this, undefined);

            this.matchElement.querySelector(".right_connecting_dot").style.top = "calc(50% - 44px)";
            this.matchElement.insertAdjacentHTML("beforeend", `<span class="right_connecting_dot relegation_connecting_dot"></span>`)
            const relegationConnectorDot = this.matchElement.querySelector(".relegation_connecting_dot");
            relegationConnectorDot.addEventListener("mousedown", function(event){this.rightDotDrag(event, true)}.bind(this));
            relegationConnectorDot.style.top = "calc(50% + 25px)";
            relegationConnectorDot.style.borderColor = "red";
            this.recalculateRightConnectors();
        }
        if(history){
            if(multipleSteps) latestHistoryChange.steps = 1; // one aditional step
            latestHistoryChange.type = "toggle_relegation";
            latestHistoryChange.target = this.getHistoryName();;
            pushHistoryObject();
        }
    }

    localConnectorCoordinates(type="right"){
        const positions = this.getPosition();
        const columnIndex = positions.roundIndex;
        const offset = positions.matchOffset + CONSTANT.matchesPaddingPx; // +20 because of matches padding.top
        if(type === "right"){
            const x = (columnIndex)*CONSTANT.columnSnapPx + ((CONSTANT.columnSnapPx - CONSTANT.matchWidthPx)/2) + CONSTANT.matchWidthPx + CONSTANT.connectorRadiusPx;
            let y = (offset+(150/2));//half of match height
            if(this.rightRelegationConnector){y-= 36;}
            console.log("calculated local promotion connector coords", x, y);
            return {x: x, y:y}
        }
        else if(type === "rightRelegation"){
            const x = (columnIndex)*CONSTANT.columnSnapPx + ((CONSTANT.columnSnapPx - CONSTANT.matchWidthPx)/2) + CONSTANT.matchWidthPx + CONSTANT.connectorRadiusPx;
            const y = (offset+(150/2) +33);//half of match height +25 offset from the center
            console.log("calculated local relegation connector coords", x, y);
            return {x: x, y:y}
        }
        else if(type === "leftupper"){
            const x = (columnIndex)*CONSTANT.columnSnapPx + ((CONSTANT.columnSnapPx - CONSTANT.matchWidthPx)/2) - CONSTANT.connectorRadiusPx;
            const y = (offset+150/2) - 36;//half of match height
            //console.log("calculated local connector coords", x, y);
            return {x: x, y:y}
        }
        else if(type === "leftlower"){
            const x = (columnIndex)*CONSTANT.columnSnapPx + ((CONSTANT.columnSnapPx - CONSTANT.matchWidthPx)/2) - CONSTANT.connectorRadiusPx;
            const y = (offset+150/2) + 33;//half of match height
            //console.log("calculated local connector coords", x, y);
            return {x: x, y:y}
        }

    }

    showMatchDetailsWidget(){
        global.matchWidget.open(this);
    }

    setTeam1(teamObj = "Random"){
        console.log("set team1 to", teamObj);
        this.getSettings().setTeam1(teamObj);
        this.updateTeams();
    }
    setTeam2(teamObj = "Random"){
        this.getSettings().setTeam2(teamObj);
        this.updateTeams();
    }

    updateTeams(){
        const settings = this.getSettings();
        let team1 = settings.team1;
        let team2 = settings.team2;
        console.log("updating teams for match", this.getHistoryName(), team1, team2);
        if(team1 instanceof Team)
            team1 = team1.name;
        else if(team1 instanceof Connector){
            if(team1.left.leftConnectors.size === 0 && team1.left.getSettings().team1 instanceof Team && team1.left.getSettings().team2 instanceof Team){
                team1 = team1.left.getSettings().team1.name + " / " + team1.left.getSettings().team2.name;
            }
            else{
                const matchId =  team1.left.matchId;
                if(team1.isRelegation())
                    team1 = "Match #" + matchId + " loser";
                else
                    team1 = "Match #" + matchId + " winner";
            }
        }
        else if(this.leftConnectors.size > 0)
            team1 = "TBD";
        this.matchElement.querySelector(".team_name1").textContent = team1;


        if(team2 instanceof Team)
            team2 = team2.name;
        else if(team2 instanceof Connector){
            if(team2.left.leftConnectors.size === 0 && team2.left.getSettings().team1 instanceof Team && team2.left.getSettings().team2 instanceof Team){
                team2 = team2.left.getSettings().team1.name + " / " + team2.left.getSettings().team2.name;
            }
            else{
                const matchId =  team2.left.matchId;
                if(team2.isRelegation())
                    team2 = "Match #" + matchId + " loser";
                else
                    team2 = "Match #" + matchId + " winner";
            }
        }
        else if(this.leftConnectors.size > 0)
            team2 = "TBD";
        this.matchElement.querySelector(".team_name2").textContent = team2;

        if(this.rightConnector && this.rightConnector.right){
            console.log("if");
            this.rightConnector.right.updateTeams();
        }
        if(this.rightRelegationConnector && this.rightRelegationConnector.right)
            this.rightRelegationConnector.right.updateTeams();

    }

    selectAsAdvancing(event){ // todo: tady je jeste spousta prace, nefuguje change_connector pri historii
        console.log(this);
        const advancingPositions = global.advacingMatch.from.getPosition();
        const external = (advancingPositions.sectionName === this.getPosition().sectionName)? false : true;
        console.log("external: ", external);
        if(this.leftConnectors.size >= 2){
            alert("Cannot select this match as it has reached its maximum amount of left connectors. Remove at least one or select another match.");
            return;
        }
        const rect = matchesPositions.get(this.getPosition().sectionName).getGrid();
        console.log(event.pageY, document.documentElement.scrollTop, rect.getBoundingClientRect().y, this.getPosition().matchOffset, rect, rect.getBoundingClientRect());
        const relativeMousePos = event.pageY - document.documentElement.scrollTop - rect.getBoundingClientRect().y - this.getPosition().matchOffset;
        let upperLower = (relativeMousePos > 75) ? "lower" : "upper";
        if(this.leftConnectors.lower)
            upperLower = "upper"
        else if(this.leftConnectors.upper)
            upperLower = "lower";

        let steps = 0;
        if(global.advacingMatch.promotion === false && !global.advacingMatch.from.rightRelegationConnector){
            global.advacingMatch.from.enableRelegation(true);
            steps = 1;
        }
        if(global.advacingMatch.promotion === false && global.advacingMatch.from.rightRelegationConnector.linePart2)
            document.getElementById(global.advacingMatch.from.rightRelegationConnector.generatedId + "_part2").parentElement.remove(); //remove it so we can generate new part2 in recalculate fcn
        const connector = (global.advacingMatch.promotion === true)? global.advacingMatch.from.rightConnector: global.advacingMatch.from.rightRelegationConnector;
        console.log(connector);

        latestHistoryChange.source = connector.getHistoryName();
        latestHistoryChange.target = this.getHistoryName();
        latestHistoryChange.position = upperLower;
        if(connector.right){
            latestHistoryChange.type = "change_connector_left";
            latestHistoryChange.old = connector.right.getHistoryName();
            latestHistoryChange.oldPosition = connector.leftPositionString(upperLower);
            connector.right.leftConnectors.delete(connector.generatedId);
            latestHistoryChange.oldPosition === "upper"? connector.right.getSettings().setTeam1("Random"): connector.right.getSettings().setTeam2("Random");
            connector.right.updateTeams();
        }
        else{
            latestHistoryChange.type = "new_connector_right";
            latestHistoryChange.steps = steps;
        }
        connector.reset(true);
        connector.setRightMatch(this);
        connector.setExternal(external);
        this.leftConnectors.set(upperLower,connector);
        connector.recalculate(true, connector.isRelegation());
        if(upperLower === "upper")
            this.setTeam1(connector);
        else
            this.setTeam2(connector);



        alert(upperLower + " " +  global.advacingMatch.promotion + " " + connector.generatedId);
        //Todo: tohle vse by mozna slo presunout do recalculate
        if(global.advacingMatch.promotion === true){ //tohle funguje, ale neni napojeno na historii - v historii musime dots zobrazovat, pokud je treba
            global.advacingMatch.from.getRightConnectingDotElement().style.display = "block";
        }
        else
            global.advacingMatch.from.getRightRelegationConnectingDotElement().style.display = "block";
        connector.right.getLeftConnectingDotElement(connector.leftPositionString()).style.display = "block";
        pushHistoryObject();
        global.advacingMatch = undefined;
        cancelSelectAdvancing();
    }

    removeTeamByConnector(sourceConnector){
        const settings = this.getSettings();
        if(settings.team1 === sourceConnector)
            this.setTeam1("Random");
        if(settings.team2 === sourceConnector)
            this.setTeam2("Random");
        this.updateTeams();
    }

    static getTeamReferenceId(team){
        if(["TBD", "Random"].includes(team))
            return team;
        if(team instanceof Team)
            return "team#" + team.id; //Team instance
        if(!(team instanceof Connector) && !["TBD", "Random"].includes(team))
            return "team#" + Team.getTeamById(team).id;//is teamId here
        if(team instanceof Connector)
            return "connector#" + team.getHistoryName(); // connector
    }

    static getConstantTeamReferenceFromString(referenceId){
        console.log("getTeamByReferenceId", referenceId);
        if(["TBD", "Random"].includes(referenceId))
            return referenceId;
        if(referenceId.startsWith("team#"))
            return Team.getTeamById(referenceId.slice(5)); //Team instance
        if(referenceId.startsWith("connector#"))
            return undefined
    }

    static getTeamReferenceFromString(referenceId){ //rozdil je jen, ze tohle umi vypocitat konektor - ocekava se teda volani az po kompletnim nacteni
        console.log("getTeamByReferenceId", referenceId);
        if(["TBD", "Random"].includes(referenceId))
            return referenceId;
        if(referenceId.startsWith("team#"))
            return Team.getTeamById(referenceId.slice(5)); //Team instance
        if(referenceId.startsWith("connector#"))
            return decodeConnector(referenceId.slice(10));
    }
}

function processMouseOver(event){
    if(draggedConnector.isActive()){
        if(draggedConnector.direction === "right"){
            snapLeftConnector(event);
        }
        else if(draggedConnector.direction === "left"){
            snapRightConnector(event);
        }
    }
}

function dragMatch(event){
    if(global.advacingMatch !== undefined)
        return;
    console.log("DRAG START");
    global.draggedMatch = event.target.closest(".match");
    //snappingMode = global.draggedMatch.parentElement.parentElement.parentElement.parentElement.querySelector(".tournament_legend .rounds_settings div[data-round='" + global.draggedMatch.parentElement.dataset.round + "'] .round_grid_snap").value;
    //dragActiveMatchesGrid = global.draggedMatch.parentElement.parentElement;
    const sectionName = global.draggedMatch.closest(".tournament_subdivision").dataset.sectionname;
    const roundIndex = global.draggedMatch.closest(".round_column").dataset.round-1;
    console.log(sectionName, roundIndex);
    const matchObject = matchesPositions.get(sectionName).get(roundIndex).getMatch(parseFloat(global.draggedMatch.style.top));
    latestHistoryChange.type = "move_match";
    latestHistoryChange.source = matchObject.getHistoryName();
    latestHistoryChange.from = parseFloat(global.draggedMatch.style.top);
    latestHistoryChange.viewportHeight = matchesPositions.get(sectionName).element.querySelector(".viewport .matches").offsetHeight;
}


export function setMatchPosition(match, columnIndex, offset){
    const positions = getMatchPosition(match);
    const matchData = matchesPositions.get(positions.sectionName).get(positions.roundIndex).getMatch(positions.matchOffset);
    console.log(match, positions, matchData);
    matchesPositions.get(positions.sectionName).get(positions.roundIndex).removeMatch(positions.matchOffset);
    matchesPositions.get(positions.sectionName).get(columnIndex).addMatch(offset, matchData);
    //alert(positions.matchOffset + " , " + matchesPositions.get(positions.sectionName).get(positions.roundIndex).biggestMatchOffset);
}

export function getMatchPosition(match){
    const roundNumberIndex = match.parentElement.dataset.round -1;
    const sectionName = match.parentElement.parentElement.parentElement.parentElement.dataset.sectionname;
    const topOffset = parseFloat(match.style.top, 10);
    return {
        roundIndex : roundNumberIndex,
        matchOffset: topOffset,
        sectionName: sectionName
    }
}
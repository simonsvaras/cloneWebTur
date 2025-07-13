
import * as CONSTANT from "./constants.js";
import { global } from "./global.js";
import * as GlobalEvents from "./events.js";
import { getMatchPosition } from "./match.js";
import { pushHistoryObject, latestHistoryChange, discardHistory } from "./history.js";



export class Connector{
    /*
        Třída konektoru spojujícího dva zápasy.
    */
    constructor(element = undefined , left = undefined, right = undefined, external = false, idOverride = undefined){
        this.line = element; //reference na element
        this.left = left; //reference na zápas na levé straně konektoru
        this.right = right; //reference na zápas na pravé straně konektoru
        this.generatedId = idOverride? idOverride : "connector_" + global.lastConnectorIdNumber++; //přiřazené ID, které se v životě nemění, pripadne tmpConnector pro leve
        this.external = external;
        this.linePart2 = undefined;
        this.eventsDisabled = false;
        this._color = undefined;
        this._collisions = undefined; //to be removed
    }

    reset(removeHTML = false){
        if(this.line && removeHTML)
            this.line.parentElement.remove();
        if(this.linePart2)
            this.linePart2.parentElement.remove();
        this.line = undefined;
        this.linePart2 = undefined;
        this.right = undefined;
    }

    setLeftMatch(match){
        this.left = match;
    }
    setRightMatch(match){
        this.right = match; //TODO: pridelat nejaky "pre-change" event, na kterym by slo zachytavat zmeny (zviditelneni konektoru) a "post-change" event
    }

    setLine(line, secondary = false){ // called separately for line1 and line2 if needed
        console.log("set line to", line , secondary);
        if(!secondary){
            if(this.line === undefined && line){
                line.addEventListener("click", function(event){this.select(event)}.bind(this));
                line.addEventListener("contextmenu", function(event){this.openContextMenu(event)}.bind(this));
            }
            this.line = line;
        }
        else{
            if(this.linePart2 === undefined && line){
                line.addEventListener("click", function(event){this.select(event)}.bind(this)); //TODO asi upravit a pridat parametr
                line.addEventListener("contextmenu", function(event){this.openContextMenu(event)}.bind(this));
            }
            this.linePart2 = line;
        }
    }
    
    get color(){
        return this._color;
    }

    set color(c){
        this._color = c;
        console.log("set color to ",c);
        if(this.line){
            this.line.style.stroke = c;
        }
        if(this.linePart2){
            this.linePart2.style.stroke = c;
        }
    }

    setExternal(external){
        if(external === true){
            this.external = true;
        }
        else{
            this.external = false;

        }
        console.log("set external to ", this.external, this);
    }

    refreshLineListeners(){
        console.log(this.line, this.line.id);
        var old_element = this.line;
        var new_element = old_element.cloneNode(true);
        
        new_element.addEventListener("click", function(event){this.select(event)}.bind(this));
        new_element.addEventListener("contextmenu", function(event){this.openContextMenu(event)}.bind(this));
        old_element.parentNode.replaceChild(new_element, old_element);
        console.log(new_element, new_element.id, new_element.parentElement);
        this.line = new_element;
        return new_element;
    }

    recalculate(generate = false, relegation = false){
        if(this.line !== undefined && this.left !== undefined && this.right !== undefined){
            //recalculate
            const leftPositions = getMatchPosition(this.left.matchElement);
            const rightPositions = getMatchPosition(this.right.matchElement);
            const rightType = relegation? "rightRelegation" : "right";
            console.log("right type:", rightType, this.generatedId);
            const leftCoords = this.left.localConnectorCoordinates(rightType);
            const rightCoords = this.right.localConnectorCoordinates("left"+    this.leftPositionString());
            console.log(leftPositions, rightPositions, leftCoords, rightCoords, this);
            //const id =  "connectorLine_" + (rightPositions.sectionIndex+1) + "_" + this.right.matchElement.parentElement.dataset.round + "_" + rightPositions.matchOffset + "_r";
            console.log(this, this.external);
            if(this.external){
                modifyExternalLine(this.generatedId, this.generatedId + "_part2", leftCoords.x, leftCoords.y, rightCoords.x, rightCoords.y);
            }
            else{
                modifyLine(this.generatedId , leftCoords.x, leftCoords.y, rightCoords.x, rightCoords.y);
            }
            return;
        }
        if(generate && this.line === undefined && this.left !== undefined && this.right !== undefined){
            const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
            const line = document.createElementNS("http://www.w3.org/2000/svg","path");
            line.id = this.generatedId;
            svg.appendChild(line);
            const leftMatchPositions = this.left.getPosition();
            document.querySelector(`.tournament_subdivision[data-sectionName='${leftMatchPositions.sectionName}'] .connectorGrid`).appendChild(svg);
            this.setLine(line);
            if(this.external){
                console.log("generating external connector svgs");
                const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
                const line = document.createElementNS("http://www.w3.org/2000/svg","path");
                line.id = this.generatedId + "_part2";
                svg.appendChild(line);
                const rightMatchPositions = this.right.getPosition();
                document.querySelector(`.tournament_subdivision[data-sectionName='${rightMatchPositions.sectionName}'] .connectorGrid`).appendChild(svg);
                this.setLine(line, true);
            }
            this.recalculate(false, relegation);
            return;
        }
        console.log("cannot recalculate this connector.", this);
    }

    select(){
        event.stopPropagation();
        
        if(this.line.classList.contains("connector_selected")){
            return;
        }
        if(global.selectedConnector){
            global.selectedConnector.deselect();
        }
        this.line.setAttribute("filter", "url(#red-glow)");
        this.line.classList.add("connector_selected");
        if(this.linePart2){
            this.linePart2.setAttribute("filter", "url(#red-glow)");
            this.linePart2.classList.add("connector_selected");
        }
        global.selectedConnector = this;
        console.log("set selected connector to", global.selectedConnector);
        
        if(this.left.rightConnector === this){
            this.left.getRightConnectingDotElement().classList.add("connecting_dot_active");
        }
        else if(this.left.rightRelegationConnector === this){
            this.left.getRightRelegationConnectingDotElement().classList.add("connecting_dot_active");
        }
        this.right.getLeftConnectingDotElement(this.leftPositionString()).classList.add("connecting_dot_active");
    }

    deselect(){
        console.log("deselected connector");
        this.line.classList.remove("connector_selected");
        this.line.removeAttribute("filter");
        if(this.linePart2){
            this.linePart2.classList.remove("connector_selected");
            this.linePart2.removeAttribute("filter");
        }
        this.left.getRightConnectingDotElement().classList.remove("connecting_dot_active");
        this.left.getRightRelegationConnectingDotElement()?.classList.remove("connecting_dot_active");
        this.right.getLeftConnectingDotElement(this.leftPositionString()).classList.remove("connecting_dot_active");
        global.selectedConnector = undefined;
    }

    delete(history = false, overrideRoundIndex = null){
        console.log("deleting connector", this);
        if(global.selectedConnector === this){
            this.deselect();
        }
        /*if(this.isRelegation()){
            this.left.getRightRelegationConnectingDotElement().style.display = null;
        }
        else{
            this.left.getRightConnectingDotElement().style = null;
        }          */  

        if(history){
            latestHistoryChange.type = "delete_connector";
            latestHistoryChange.source = this.getHistoryName(null, overrideRoundIndex, null);
            latestHistoryChange.id = this.generatedId;
            if(this.right){ // muze to byt odpojeny relegation connector
                latestHistoryChange.target = this.right.getHistoryName(null, overrideRoundIndex? (this.right.getPosition().roundIndex + overrideRoundIndex) : null, null);
                latestHistoryChange.position = this.leftPositionString();
            }
            pushHistoryObject();
        }
        if(this.right){ //because this can be an unconnected relegation connector
            this.right.getLeftConnectingDotElement(this.leftPositionString()).style = null;
            this.right.leftConnectors.delete(this.generatedId);
            this.right.removeTeamByConnector(this);
        }

        if(this.line) //beacuse this can be an unconnected relegation connector
            this.line.parentElement.remove(); 
        if(this.linePart2)
            this.linePart2.parentElement.remove();
        this.line = undefined;
        this.right = undefined;
        this.left.getRound().getSection().highlightCollisions();
    }

    getHistoryName(){
        if(this.left === undefined)
            return "ERROR";
        const match = this.left;
        const positions = match.getPosition();
        return positions.sectionName + "_" + positions.roundIndex + "_" + positions.matchOffset + (this.isRelegation()? "rel" : "");
    }

    rightConnectorDrag(relegation = false){
        //get section bouding rect
        const positions = this.left.getPosition();
        
        const match = this.left;
        const localConnectorCoords = relegation? match.localConnectorCoordinates("rightRelegation") : match.localConnectorCoordinates("right");
        if(!document.getElementById(this.generatedId)){
            //create the line
            const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
            const line = document.createElementNS("http://www.w3.org/2000/svg","path");
            line.id = this.generatedId;
            svg.appendChild(line);
            document.querySelector(`.tournament_subdivision[data-sectionName='${positions.sectionName}'] .connectorGrid`).appendChild(svg);
            this.setLine(line);
        }
        if(this.right !== undefined){
            this.right.removeTeamByConnector(this);
            this.right.leftConnectors.delete(this.generatedId);
            this.right = undefined;
        }

        draggedConnector.setX(localConnectorCoords.x).setY(localConnectorCoords.y).setDirection("right").setSnapped(false).setMatchPositions(positions).setMatch(match).setConnector(this).activate();
        this.eventsDisabled ? this.line.classList.add("dragged") : this.line.classList.remove("dragged");

        modifyLine(this.generatedId, localConnectorCoords.x, localConnectorCoords.y, localConnectorCoords.x, localConnectorCoords.y);
    }

    leftConnectorDrag(){
        //get section bouding rect
        //console.log(event, connector, connector.parentElement, connector.parentElement.parentElement);
        const positions = this.right.getPosition();
    
        const match = this.right;
        const localConnectorCoords = match.localConnectorCoordinates("left" + this.leftPositionString());
        
        //create the line
        const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
        const line = document.createElementNS("http://www.w3.org/2000/svg","path");
        line.id = this.generatedId; //tmpConnector
        svg.appendChild(line);
        document.querySelector(`.tournament_subdivision[data-sectionName='${positions.sectionName}'] .connectorGrid`).appendChild(svg);
        this.setLine(line);

        this.eventsDisabled ? this.line.classList.add("dragged") : this.line.classList.remove("dragged");
        modifyLine(this.generatedId, localConnectorCoords.x, localConnectorCoords.y, localConnectorCoords.x, localConnectorCoords.y);//tady dopuravit koncovou pozici
    
        draggedConnector.setX(localConnectorCoords.x).setY(localConnectorCoords.y).setDirection("left").setSnapped(false).setMatchPositions(positions).setMatch(match).setConnector(this).activate();
    }

    getLeftLocalCoordinates(){
        if(this.left.rightConnector === this){
            return this.left.localConnectorCoordinates("right");
        }
        else if(this.left.rightRelegationConnector === this){
            return this.left.localConnectorCoordinates("rightRelegation");
        }
        return undefined; //should never happen, but just in case
    }

    isRelegation(){
        if(this.left.rightConnector === this){
            return false;
        }
        return true;
    }

    isLeftUpper(){
        console.log(this.right.leftConnectors.upper, this.right.leftConnectors.upper === this);
        if(this.right.leftConnectors.upper === this){
            return true;
        }
        return false;
    }

    isLeftLower(){
        if(this.right.leftConnectors.lower === this){
            return true;
        }
        return false;
    }

    leftPositionString(){
        if(this.isLeftLower())
            return "lower";
        else if(this.isLeftUpper())
            return "upper";
        return undefined;
    }

    getRightLocalCoordinates(){
        console.log("left"+this.leftPositionString());
        return this.right.localConnectorCoordinates("left"+this.leftPositionString());
    }

    openContextMenu(event){
        console.log("context menu opened on connector", global.selectedConnector, this);
        if(global.selectedConnector !== this)
            return;
        event.preventDefault();
        event.stopPropagation();
        GlobalEvents.removeContextMenu();


        const contextMenuHtml = document.getElementById("contextMenuSelectedConnectorTemplate").content.cloneNode(true).firstElementChild;

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

    viewLeftMatchDetails(){
        this.left.showMatchDetailsWidget();
    }

    viewRightMatchDetails(){
        if(!this.right)
            return;
        this.right.showMatchDetailsWidget();
    }

    scrollLeftMatchIntoView(){
        this.left.matchElement.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    
    scrollRightMatchIntoView(){
        if(!this.right)
            return;
        this.right.matchElement.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    toggleEvents(enabled){
        this.eventsDisabled = enabled? false: true;
        console.log("toggle events", enabled, this.line);
        if(enabled && this.line){
            this.line.classList.remove("dragged");
        }
        else if(!enabled && this.line){
            this.line.classList.add("dragged");
        }
    }

}

export function dropConnector(event){
    console.log("Drop",draggedConnector);
    if(draggedConnector.connector instanceof Connector){
        draggedConnector.connector.toggleEvents(true);
        document.getElementById(draggedConnector.connector.generatedId).parentElement.remove();

        if(draggedConnector.connector.generatedId === "tmpConnector"){
            draggedConnector.match.leftConnectors.delete("tmpConnector");
        }
        //remove its references
        draggedConnector.connector.line = undefined;

    }
    //draggedConnector = undefined;
    draggedConnector.deactivate();
    //dragActiveMatchesGrid = undefined;
    discardHistory();
}

export function modifyLine(id, x1, y1, x2, y2) {
    console.log("modifyLine id", id);
    const line = document.getElementById(id);
    const svg = line.parentElement;
    const svg_width = Math.max(Math.abs(x2-x1), CONSTANT.matchHalfFreeSpacePx - CONSTANT.connectorRadiusPx);
    svg.style.left = x1 > x2? (x1 - svg_width) + "px" : x1 + "px";
    svg.style.top = Math.min(y1, y2) + "px";
    svg.style.width = svg_width + "px";
    svg.style.height = Math.abs(y2-y1)+2 + "px";

    let verticalStartPosition= 1;
    let horizontalStartPosition = 0;
    let verticalEndPosition= y2-y1+1;
    let horizontalEndPosition = x2-x1;
    let guidelinePoint = CONSTANT.matchHalfFreeSpacePx - CONSTANT.connectorRadiusPx-1;

    if(Math.abs(y2-y1) === 0){ //gotta expand the svg container for blur to work on straight lines
        svg.style.height = 12 + "px";
        svg.style.top = Math.min(y1, y2) - 6 + "px";
        verticalStartPosition = verticalEndPosition = 1 + 6;
    }

    if(verticalEndPosition < 0){
        verticalEndPosition = (Math.abs(y2-y1)) + verticalEndPosition;
        verticalStartPosition = Math.abs(y2-y1)+1;
    }
    if(horizontalEndPosition < 0){
        horizontalEndPosition = Math.max(Math.abs(x2-x1), CONSTANT.matchHalfFreeSpacePx - CONSTANT.connectorRadiusPx) + horizontalEndPosition;
        horizontalStartPosition = Math.max(Math.abs(x2-x1), CONSTANT.matchHalfFreeSpacePx - CONSTANT.connectorRadiusPx);
        //guidelinePoint = horizontalStartPosition - (CONSTANT.matchHalfFreeSpacePx - CONSTANT.connectorRadiusPx + 1);
    }

    console.log("params", id, x1, y1, x2, y2, verticalStartPosition, horizontalStartPosition, verticalEndPosition, horizontalEndPosition, guidelinePoint);

    const d = `
    M ${horizontalStartPosition} ${verticalStartPosition}
    
    H ${guidelinePoint}
    V ${verticalEndPosition}
    H ${horizontalEndPosition}`;
    line.setAttribute("d", d);
}

function modifyExternalLine(id, id2, x1, y1, x2, y2){
    const line = document.getElementById(id);
    const svg = line.parentElement;
    const line2 = document.getElementById(id2);
    const svg2 = line2.parentElement;
    svg.style.left = x1 + "px";
    svg.style.top = y1 + "px";
    svg.style.width = 50 + "px";
    svg.style.height = 50 + "px";
    svg2.style.left = (x2-50) + "px";
    svg2.style.top = (y2-50) + "px";
    svg2.style.width = 50 + "px";
    svg2.style.height = 50 + "px";

    const d = `
        M 1 1

        h 20 v 20
        h 5
        l -5 5
        l -5 -5
        h 5
    `;
    line.setAttribute("d", d);

    const d2 = `
        M 49 49

        h -20 v -20
        h -5
        l 5 -5
        l 5 5
        h -5
    `;
    line2.setAttribute("d", d2);
}


export function snapLeftConnector(event){
    console.log("SNAPPING TO LEFT CONNECTOR", event);
    const match = event.target.closest("div.match");
    //const connector = match.querySelector("span.left_connecting_dot");
    const round = match.parentElement.dataset.round;
    const targetMatch = matchesPositions.get(draggedConnector.matchPositions.sectionName).get(round-1).getMatch(parseFloat(match.style.top));
    console.log(draggedConnector.match.getPosition(),  getMatchPosition(match));
    if(draggedConnector.match.getPosition().roundIndex >= getMatchPosition(match).roundIndex || targetMatch.leftConnectors.size >= 2){
        console.log("cannot snap to position before the dragged connector or match already has 2 connectors")
        return;
    }

    if(targetMatch.leftConnectors.has(draggedConnector.connector)){
        console.log("This connector is already snapped to this match!");
        return;
    }

    /*if( (draggedConnector.match.rightRelegationConnector && draggedConnector.match.rightRelegationConnector.right === targetMatch)){
        console.log("Error: Not snapping the connector due to integrity restriction");
        return;
    }*/

    const positions = getMatchPosition(match);
    const rect = matchesPositions.get(draggedConnector.match.getPosition().sectionName).getGrid();
    const relativeMousePos = event.pageY - document.documentElement.scrollTop - rect.getBoundingClientRect().y - targetMatch.getPosition().matchOffset;
    let upperLower = (relativeMousePos > 75) ? "lower" : "upper";
    if((upperLower === "lower" && targetMatch.leftConnectors.lower === draggedConnector.connector) || (upperLower === "upper" && targetMatch.leftConnectors.upper === draggedConnector.connector)){
        console.log(targetMatch.leftConnectors.lower, targetMatch.leftConnectors.upper, draggedConnector.connector);
        return;//already snapped at this position
    }
    if(targetMatch.leftConnectors.lower)
        upperLower = "upper"
    else if(targetMatch.leftConnectors.upper)
        upperLower = "lower";
    console.log("relative position",relativeMousePos, upperLower);
    const rightConnectorCoords = targetMatch.localConnectorCoordinates("left" + upperLower);
    const line = draggedConnector.connector.line;
    line.id = draggedConnector.connector.generatedId;

    if(draggedConnector.connector.right){
        draggedConnector.connector.right.leftConnectors.delete(draggedConnector.connector.generatedId);
    }
    
    draggedConnector.connector.setLine(line);
    draggedConnector.connector.setRightMatch(matchesPositions.get(positions.sectionName).get(positions.roundIndex).getMatch(positions.matchOffset));
    draggedConnector.connector.setLeftMatch(draggedConnector.match);
    draggedConnector.connector.toggleEvents(true);


    targetMatch.leftConnectors.set(upperLower, draggedConnector.connector);
    targetMatch.leftConnectors.get(draggedConnector.connector.generatedId).refreshLineListeners();
    modifyLine(line.id, draggedConnector.startingPointX, draggedConnector.startingPointY, rightConnectorCoords.x, rightConnectorCoords.y)
    draggedConnector.snapped = true;
    latestHistoryChange.source = draggedConnector.connector.getHistoryName();
    latestHistoryChange.target = targetMatch.getHistoryName();
    latestHistoryChange.position = draggedConnector.connector.leftPositionString();
    const audio = new Audio('minimal-pop-click-ui-1-198301.mp3');
    audio.play();
    targetMatch.removeTeamByConnector(draggedConnector.connector);
    if(upperLower === "upper"){
        targetMatch.setTeam1(draggedConnector.connector);
    }
    else if(upperLower === "lower"){
        targetMatch.setTeam2(draggedConnector.connector);
    }
}

export function snapRightConnector(event){
    console.log("SNAPPING TO RIGHT CONNECTOR", draggedConnector.connector.line.id, draggedConnector.connector.line.parentNode === null, draggedConnector.connector.line.parentNode);
    const match = event.target.closest("div.match");

    const round = match.parentElement.dataset.round;
    const targetMatch = matchesPositions.get(draggedConnector.matchPositions.sectionName).get(round-1).getMatch(parseFloat(match.style.top));
    const positions = getMatchPosition(match);
    console.log(draggedConnector.match.getPosition(), positions, targetMatch, targetMatch.rightConnector);

    let rect = matchesPositions.get(draggedConnector.match.getPosition().sectionName).getGrid();
    const relativeMousePos = event.pageY - document.documentElement.scrollTop - rect.getBoundingClientRect().y - targetMatch.getPosition().matchOffset;
    const rightConnector = (targetMatch.rightRelegationConnector && relativeMousePos > 75) ? targetMatch.rightRelegationConnector : targetMatch.rightConnector;
    console.log(rightConnector, event.offsetY, relativeMousePos);

    if(draggedConnector.match.getPosition().roundIndex <= positions.roundIndex){
        console.log("Error: Position before the dragged connector");
        return;
    }
    else if(rightConnector.right !== undefined){
        console.log("Error: This connector already occupied", rightConnector.right);
        return;
    }
    else if(!draggedConnector.snapped && (
     (targetMatch.rightRelegationConnector && targetMatch.rightRelegationConnector.right === draggedConnector.match) ||
     targetMatch.rightConnector.right === draggedConnector.match)
    ){
        console.log("Error: Not snapping the connector due to integrity restriction");
        return;
    }
    
    if(rightConnector.right === draggedConnector.match){
        console.log("This connector is already snapped to this position!");
        return;
    }

    //targetMatch.clearSnapping();

    
    const rightConnectorCoords = rightConnector.getLeftLocalCoordinates();
    const position = draggedConnector.connector.leftPositionString();
    console.log(targetMatch, draggedConnector.connector.line.id, draggedConnector.connector);

    let line = draggedConnector.connector.line;

    if(line.id !== "tmpConnector"){
        console.log("snapping within the same match");
        //pretahujeme connectory v ramci jednoho zapasu
        //vyresetovat "ten druhy" konektor
        draggedConnector.match.leftConnectors.get(line.id).reset(false);
    }

    line.id = rightConnector.generatedId;
    rightConnector.setLine(line);
    console.log("LINE", line.id, line.parentNode === null, line.parentNode, rightConnector.line.id, position);
    console.log(draggedConnector.match.leftConnectors.upper);
    //rightConnector.setLeftMatch(matchesPositions.get(positions.sectionName).get(positions.roundIndex).getMatch(positions.matchOffset));
    rightConnector.setRightMatch(draggedConnector.match);
    //draggedConnector.match.leftConnectors.delete(draggedConnector.connector.generatedId); //tmpConnector
    draggedConnector.match.leftConnectors.set(position, rightConnector);

    draggedConnector.connector = rightConnector;
    rightConnector.refreshLineListeners(); //tohle rozhodi reference vytvorenim nove kopiie path a nahrazeni stare. V dragged connectoru ale zustava reference na starou
    draggedConnector.connector.toggleEvents(true);

    modifyLine(rightConnector.generatedId, draggedConnector.startingPointX, draggedConnector.startingPointY, rightConnectorCoords.x, rightConnectorCoords.y)
    draggedConnector.snapped = true;


    latestHistoryChange.target = rightConnector.getHistoryName();
    latestHistoryChange.position = position;
    const audio = new Audio('minimal-pop-click-ui-1-198301.mp3');
    audio.play();

    if(draggedConnector.connector.leftPositionString() === "upper"){
        draggedConnector.match.setTeam1(draggedConnector.connector);
    }
    else if(draggedConnector.connector.leftPositionString() === "lower"){
        draggedConnector.match.setTeam2(draggedConnector.connector);
    }
}

class DraggedConnector{
    constructor(startingPointX, startingPointY, direction, snapped, matchPositions, match, connector){
        this.startingPointX = startingPointX,
        this.startingPointY = startingPointY,
        this.direction = direction,
        this.snapped = snapped,
        this.matchPositions = matchPositions,
        this.match = match,
        this.connector = connector;
        this.active = true;
    }

    setX(val){
        this.startingPointX = val;
        return this;
    }
    setY(val){
        this.startingPointY = val;
        return this;
    }
    setDirection(val){
        this.direction = val;
        return this;
    }
    setSnapped(val){
        this.snapped = val;
        return this;
    }
    setMatchPositions(val){
        this.matchPositions = val;
        return this;
    }
    setMatch(val){
        this.match = val;
        return this;
    }
    setConnector(val){
        this.connector = val;
        return this;
    }

    deactivate(){
        this.active = false;
        return this;
    }
    activate(){
        this.active = true;
        return this;
    }

    isActive(){
        return this.active;
    }
}

export const draggedConnector = new DraggedConnector();
draggedConnector.deactivate();
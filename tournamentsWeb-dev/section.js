import { Round } from "./round.js";
import { pushHistoryObject, discardHistory, latestHistoryChange } from "./history.js";
import { draggedConnector, modifyLine } from "./connector.js";
import { getMatchPosition, setMatchPosition } from "./match.js";
import * as CONSTANT from "./constants.js";
import { getColumnSnappingMode, adjustSectionCanvasHeight, updateSectionsList, updateRoundList, matchesPositions, closestNumber } from "./tournaments.js";
import { global } from "./global.js";

class SectionSettings{
    constructor(order = null){
        this.order = order;
        //TODO: sectionname delegovat sem, nebude to uz key v mape, ale jen polozka tady. Pak kdyz zmenime jmeno mapy, tak nemusime celou mapu reindexovat.
    }
}

export class Section {
    constructor(sectionName, sectionElement, order = null){
        this.name = sectionName;
        this.element = sectionElement;
        this.columnsLocked = false;
        this.rounds = new Map();
        this.settings = new SectionSettings(order);

        console.log(sectionElement);
        sectionElement.querySelector(".section_toolbar .column_lock img").addEventListener("click", function(event){this.changeLockedState(event)}.bind(this));
        sectionElement.querySelector(".section_toolbar .fullscreen img").addEventListener("click", function(event){this.fullscreen_section(event)}.bind(this));
        sectionElement.querySelector(".tournament_delimiter .section_name").addEventListener("change", function(event){this.nameChanged(event)}.bind(this));
        sectionElement.querySelector(".add_round_column .add_round_button").addEventListener("click", function(event){this.createNewRound(event, true)}.bind(this));
        sectionElement.querySelector(".matches").addEventListener("mousemove", processMouseMove);
        sectionElement.querySelector(".viewport").addEventListener("contextmenu", function(event){this.openContextMenu(event, true)}.bind(this));
        sectionElement.querySelector(".viewport").addEventListener("scroll", function(event){this.scrollLegend(event)}.bind(this));
        sectionElement.querySelector(".section_collapse_icon").addEventListener("click", section_collapse);
        sectionElement.querySelector(".section_delete_icon").addEventListener("click", section_delete);

        this.updateInsertButtons();

    }

    setName(name, history = false){
        const oldName = this.name;
        this.name = name;
        console.log("changed section name from ", oldName, "to", name);
        //the three lines below make sure we have the new section name as key in matchesPositions map
        const value = matchesPositions.get(oldName);
        matchesPositions.delete(oldName);
        matchesPositions.set(name, value);
        this.element.dataset.sectionname = name;
        this.element.querySelector(".tournament_delimiter input.section_name").value = name;
        updateSectionsList();
        if(history){
            latestHistoryChange.type = "modify_section";
            latestHistoryChange.newName = this.name;
            latestHistoryChange.oldName = oldName;
            pushHistoryObject();
        }
    }

    changeLockedState(event){
        event.stopPropagation();
        this.columnsLocked = !this.columnsLocked;
        if(this.columnsLocked)
            this.element.querySelector(".section_toolbar .column_lock img").src = "https://cdn-icons-png.flaticon.com/512/747/747305.png";
        else
            this.element.querySelector(".section_toolbar .column_lock img").src = "https://cdn-icons-png.flaticon.com/512/747/747315.png";
    }

    isLocked(){
        return this.columnsLocked;
    }

    async fullscreen_section(e){
        const toolbar = document.getElementById("tournament_toolbar");
        if(!document.fullscreenElement){
            this.element.classList.add("fullscreen");
            toolbar.classList.add("none");
            
            let fullScreenExitFn = function() { //gets called by document.exitFullscreen();
                console.log("FULLSCREEN", document.fullscreenElement);
                if(!document.fullscreenElement){
                    this.element.classList.remove("fullscreen");
                    toolbar.classList.remove("none");
                    this.element.removeEventListener("fullscreenchange", fullScreenExitFn);
                    document.querySelectorAll(`.tournament_subdivision`).forEach(x => x.classList.remove("section_minimized"));
                    this.element.querySelector(".section_toolbar .fullscreen img").src = "https://cdn-icons-png.flaticon.com/512/1549/1549457.png";
                }
            }
            await this.element.requestFullscreen();

            this.element.addEventListener("fullscreenchange", fullScreenExitFn.bind(this));
            document.querySelectorAll(`.tournament_subdivision:not([data-sectionname='${this.element.dataset.sectionname}'])`).forEach(x => x.classList.add("section_minimized"));
            this.element.querySelector(".section_toolbar .fullscreen img").src = "https://cdn-icons-png.flaticon.com/512/2989/2989876.png";
        }
        else{
            document.exitFullscreen();
        }
    }

    nameChanged(e){ //todo: muzeme volat i z historie, takze parametr muze byt i string
        if (this.name !== e.target.value && isSectionNameValid(e.target.value)) {
            this.setName(e.target.value, true);
            return;
        }
        alert("The section name you have provided is invalid or forbiden in this context. Please choose a different name");
        return;
    }

    createNewRound(event, history = false, forceIndex = null){ //event argument se nepouziva, eventuelne odstranit
        if(forceIndex === null){
            forceIndex = this.count();
        }
        else{
            //"roztrhnout mapu, abychom mohli kolo vlozit doprostred"
            const tmpcount = this.count();
            for(let i = tmpcount-1; i>= forceIndex; i--){
                //alert("setting " + (i) + "to " + (i+1));
                this.set(i+1, this.get(i));
                this.get(i+1).element.dataset.round = i+2;
                matchesPositions.get(this.name).get(i+1).recalculateMatches();//recalculate its connectors
                this.element.querySelector(`.tournament_legend .rounds_settings > div:nth-of-type(${i+1})`).dataset.round = i+2;
                console.log(this.element.querySelector(`.tournament_legend .rounds_settings > div:nth-of-type(${i})`));
            }
        }
        console.log("FORCE INDEX", forceIndex);

        const matchesGrid = this.element.querySelector(".viewport .matches");
        const legendGrid = this.element.querySelector(".tournament_legend .rounds_settings");
        const newRoundNumber = forceIndex+1;


        let legendPosition = "afterend";
        let roundPosition = "afterend";
        let legendPlacement = legendGrid.querySelector(`div[data-round='${forceIndex}']`);
        let roundPlacement = matchesGrid.querySelector(`.round_column[data-round='${forceIndex}']`);
        if(this.count() === 0){
            legendPosition = "beforeend";
            roundPosition = "beforebegin";
            legendPlacement = legendGrid;
            roundPlacement = matchesGrid.querySelector(".add_round_column");
        }
        else if(forceIndex === 0){
            legendPlacement = legendGrid.querySelector(`div[data-round='1']`);
            legendPosition = "beforebegin";
            roundPosition = "beforebegin";
            roundPlacement = matchesGrid.querySelector(`.round_column[data-round='1']`);
        }
        else if(forceIndex === this.count()){
            legendPlacement = legendGrid.querySelector(`div[data-round='${forceIndex}']`);
            legendPosition = "afterend";
            roundPosition = "beforebegin";
            roundPlacement = matchesGrid.querySelector(".add_round_column");
        }
        console.log(legendPlacement);

        legendPlacement.insertAdjacentHTML(legendPosition, `<div class="round_setting" data-round="${newRoundNumber}">
                <div class="round_setting_content">
                    <input type="text" class="legend_round_name" value="Round ${newRoundNumber}">
                    <div><p class="legend_format">BO1</p>, <p class="legend_start">ASAP</p></div>
                    <div>
                        <img class="round_action_button round_delete_button" src="https://cdn-icons-png.flaticon.com/512/484/484662.png" alt="Delete round">
                        <img class="round_action_button round_settings_button" src="https://cdn-icons-png.flaticon.com/512/2040/2040504.png" alt="Round settings">
                        <img class="round_action_button round_add_match_button" src="https://cdn-icons-png.flaticon.com/512/992/992651.png" alt="Add match">

                    </div>
                </div>
            </div>`);
        
        const roundElement = roundHTML(newRoundNumber);
        roundPlacement.insertAdjacentElement(roundPosition, roundElement);

        //const roundName = document.querySelector(`.tournament_subdivision[data-sectionName="${this.name}"] .tournament_legend .rounds_settings div:nth-child(${newRoundNumber}) .legend_round_name`);
        const round = new Round(forceIndex, roundElement, 0 ,"Round " + newRoundNumber, "Free");
        this.set(round.getIndex(), round);
        console.log(newRoundNumber, this.name);
        //roundName.addEventListener("change", function(event){this.setRoundName(round.getIndex(), event.target.value, true)}.bind(this))
        updateRoundList(this.name);

        const pattern = /^Round [1-9]\d*$/;
        let position = 1;

        console.log(this.element.querySelectorAll(".tournament_legend .rounds_settings .round_setting .legend_round_name"));
        for (let input of this.element.querySelectorAll(".tournament_legend .rounds_settings .round_setting .legend_round_name")) {
            console.log("Testing round", position, "for match", newRoundNumber, pattern.test(input.value));
            if(position > newRoundNumber && pattern.test(input.value)){
                input.value = "Round " + (position);
                this.setRoundName(position-1, "Round " + position);
            }
            position++;
        }

        this.updateInsertButtons();

        if(history){
            latestHistoryChange.type = "add_round";
            latestHistoryChange.section = this.name;
            latestHistoryChange.roundIndex = forceIndex;
            pushHistoryObject();
        }
    }

    setRoundName(roundIndex, name, history = false){
        /*this.element.querySelector(`.tournament_legend .rounds_settings div:nth-of-type(${roundIndex+1}) .legend_round_name`).value = name;
        console.log(this.element.querySelector(`.tournament_legend .rounds_settings div:nth-of-type(${roundIndex+1}) .legend_round_name`));
        console.log(roundIndex);*/
        this.get(roundIndex).getSettings().setSettings(name, undefined, undefined, history, this.name+"_"+roundIndex);
    }

    openContextMenu(event){
        event.preventDefault();
        event.stopPropagation();

        console.log("context menu on section");
    }
    

    /*Mimick map behaviour and expose the same methods*/

    set(key, value){
        return this.rounds.set(key, value);
    }

    get(key){
        return this.rounds.get(key);
    }

    count(){
        return this.rounds.size;
    }

    keys(){
        return this.rounds.keys();
    }

    deleteRound(key){
        this.rounds.delete(key);
    }

    getGrid(){
        return this.element.querySelector(".viewport .grid");
    }

    getConnectorGrid(){
        return this.element.querySelector(".viewport .connectorGrid");
    }

    delete(history = false){
        const roundNumber = this.count();
        let count = 0;
        /*for(let round of this.rounds.values()){
            console.log(round);
            round.delete(history, count++);
        }*/
        for(let round of Array.from(this.rounds.values()).slice().reverse()){
            console.log(round);
            round.delete(history, count++);
        }
        this.element.remove();

        if(history){
            latestHistoryChange.type = "delete_section";
            latestHistoryChange.section = this.name;
            latestHistoryChange.settings = this.settings;
            latestHistoryChange.steps = roundNumber;
            pushHistoryObject();
        }
        matchesPositions.delete(this.name);
        updateSectionsList();
    }

    get order(){
        return this.settings.order;
    }

    maxMatchOffset(){
        let offset = 0;
        for(const round of this.rounds.values()){
            if(round.biggestMatchOffset > offset)
                offset = round.biggestMatchOffset;
        }
        return offset;
    }

    updateInsertButtons(){
        const matchesGrid = this.element.querySelector(".viewport .matches");
        const legendGrid = this.element.querySelector(".tournament_legend .rounds_settings");

        matchesGrid.querySelectorAll('.insert_round_column').forEach(e => e.remove());
        legendGrid.querySelectorAll('.insert_round_column').forEach(e => e.remove());

        const rounds = legendGrid.querySelectorAll('.round_setting');
        rounds.forEach((round, index) => {
            if(index < rounds.length - 1){
                const col = document.createElement('div');
                col.classList.add('insert_round_column');
                const btn = document.createElement('div');
                btn.classList.add('insert_round_button');
                btn.textContent = '+';
                btn.dataset.index = index + 1;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.createNewRound(e, true, parseInt(btn.dataset.index));
                });
                col.appendChild(btn);
                round.insertAdjacentElement('afterend', col);
            }
        });
    }


    highlightCollisions(){
        console.log("highlighting collisiions on section", this);
        const points = [];
        // Collect connector start/end events from each round/match
        for(let round of this.rounds.values()){
            for(let match of round.matches.values()){
                console.log(match, match.rightConnector);
                if(match.rightConnector.right && !match.rightConnector.external){

                    let connectorStartY = match.rightConnector.getLeftLocalCoordinates().y;
                    let connectorEndY = match.rightConnector.getRightLocalCoordinates().y;
                    if(connectorEndY < connectorStartY){
                        console.log("swapping connector start with end", connectorStartY, connectorEndY);
                        [connectorEndY, connectorStartY] = [connectorStartY, connectorEndY];
                    }
                    points.push([connectorStartY, "start", match.rightConnector]);
                    points.push([connectorEndY, "end", match.rightConnector]);                    
                }
                if(match.rightRelegationConnector && match.rightRelegationConnector.right){
                    console.log(match, match.rightRelegationConnector);
                    if(match.rightRelegationConnector.right && !match.rightRelegationConnector.external){

                        let connectorStartY = match.rightRelegationConnector.getLeftLocalCoordinates().y;
                        let connectorEndY = match.rightRelegationConnector.getRightLocalCoordinates().y;
                        if(connectorEndY < connectorStartY){
                            console.log("swapping connector start with end", connectorStartY, connectorEndY);
                            [connectorEndY, connectorStartY] = [connectorStartY, connectorEndY];
                        }
                        points.push([connectorStartY, "start", match.rightRelegationConnector]);
                        points.push([connectorEndY, "end", match.rightRelegationConnector]);                    
                    }
                }
            }
        }
        // Sort events by Y; when Y’s tie, "start" comes before "end"
        points.sort((a, b)=>  {
            if(a[0] > b[0])
                return 1;
            if(a[0] < b[0])
                return -1;
            if(a[1] === "start" && b[1] === "end")
                return -1;
            if(a[1] === "end" && b[1] === "start")
                return 1;
        });

        console.log("sorted line points", points);
        this._collisionLines = [];

        // Check if the given connector intersects any connector already open.
        let intersectsOpenedConnectors = function(openedConnectors, connector){
            //kontroly validity probihaji pred vstupem do funkce, nemusime kontrolovat zde
            for(const opened of openedConnectors.values()){
                if(intersectingConnectors(connector, opened))
                    return true;
            }
            return false;            
        }

        // Check if two connectors intersect, independent of argument order.
        // It checks if one connector's left coordinate lies within the horizontal range of the other
        // or if the vertical coordinate of the other lies within the vertical range of the first.
        let intersectingConnectors = function(connectorA, connectorB){
            if(connectorA === connectorB){
                console.log("connectorA === connectorB");
                return false;
            }
            //algoritmus zkouma, zda connector B protina connector A. Závisí na pořadí!! -> B protíná A !-> A protíná B
            if(connectorA === connectorB) return false;
            const ALeft = connectorA.getLeftLocalCoordinates();
            const ARight = connectorA.getRightLocalCoordinates();
            const BLeft = connectorB.getLeftLocalCoordinates();
            const BRight = connectorB.getRightLocalCoordinates();
            const conditionAB = (Math.min(BLeft.x, BRight.x) <= ALeft.x && ALeft.x <= Math.max(BLeft.x, BRight.x)) &&
                                ((Math.min(ALeft.y, ARight.y) <= BRight.y && BRight.y <= Math.max(ALeft.y, ARight.y)) ||
                                (ALeft.x === BLeft.x && (Math.min(BLeft.y, BRight.y) <= ALeft.y && ALeft.y <= Math.max(BLeft.y, BRight.y))) ||
                                ((connectorB.right.getRound().getIndex()-1 === connectorA.left.getRound().getIndex()) && BLeft.y === ARight.y));
            const conditionBA = (Math.min(ALeft.x, ARight.x) <= BLeft.x && BLeft.x <= Math.max(ALeft.x, ARight.x)) &&
                                ((Math.min(BLeft.y, BRight.y) <= ARight.y && ARight.y <= Math.max(BLeft.y, BRight.y)) ||
                                (ALeft.x == BLeft.x && (Math.min(ALeft.y, ARight.y) <= BLeft.y && BLeft.y <= Math.max(ALeft.y, ARight.y))) ||
                                ((connectorA.right.getRound().getIndex()-1 === connectorB.left.getRound().getIndex()) && ALeft.y === BRight.y));

            console.log("conditionAB", conditionAB, "conditionBA", conditionBA, "A:", connectorA, "B:", connectorB);                                
            return conditionAB || conditionBA;
        }

        // Sweep-line: process sorted events to update collision highlighting.
        const openedConnectors = new Set();
        for(let i = 0; i< points.length; i++){
            const [currentY, type, connector, roundIndex] = points[i];
            if(type === "start"){
                console.log("start", openedConnectors, openedConnectors.size);
                connector.color = (intersectsOpenedConnectors(openedConnectors, connector)) ? CONSTANT.connectorCollisionHighlightColors[1] : CONSTANT.connectorCollisionHighlightColors[0];
                openedConnectors.add(connector);

            }
            else if(type === "end"){
                console.log("end", openedConnectors, openedConnectors.size);
                openedConnectors.forEach(function(openedConn){
                    if(intersectingConnectors(connector, openedConn)){
                        console.log("collision between", connector, "and" ,openedConn);
                        openedConn.color = CONSTANT.connectorCollisionHighlightColors[1];
                        connector.color = CONSTANT.connectorCollisionHighlightColors[1];
                    }
                });
                openedConnectors.delete(connector);
            }
        }
    }

    scrollLegend(event){
        this.element.querySelector(`.tournament_legend_content`).style.left = -event.target.scrollLeft + "px";
    }

    updateSnapping(startRoundIndex){
        for(let i = startRoundIndex; i< this.count(); i++){
            const value = this.get(i).getSettings().snappingMode;
            console.log("roundIndex ", i, value);
            switch(value){
                case "Free":
                    this.get(i).getSettings().setSettings(undefined, undefined, undefined, false, this.name+"_"+i, "Free", 0);
                break;
                case "Initial":
                    this.get(i).getSettings().setSettings(undefined, undefined, undefined, false, this.name+"_"+i, "Initial", 200);
                break;
                case "Elimination":
                    if(i > 0){
                        let fallback = true;
                        for(let y = i-1;y >= 0; y--){
                            console.log("Elimination loop before match index", i, "looping index", y,"offset", this.get(y).getSettings().snappingOffset)
                            if(this.get(y).getSettings().snappingOffset === 0){
                                continue;
                            }
                            this.get(i).getSettings().setSettings(undefined, undefined, undefined, false, this.name+"_"+i, "Elimination", this.get(y).getSettings().snappingOffset *2);
                            console.log("set snapping offset to", this.get(y).getSettings().snappingOffset*2);
                            fallback = false;
                            break;                            
                        }
                        if(fallback){
                            console.log("set snapping offset to 200");
                            this.get(i).getSettings().setSettings(undefined, undefined, undefined, false, this.name+"_"+i, "Elimination", 200);
                        }
                        
                    }
                    else{
                        console.log("set snapping offset to 200");
                        this.get(i).getSettings().setSettings(undefined, undefined, undefined, false, this.name+"_"+i, "Elimination", 200);
                    }
                break;
                case "Same as previous":
                    if(i > 0){
                        this.get(i).getSettings().setSettings(undefined, undefined, undefined, false, this.name+"_"+i, "Same as previous", this.get(i-1).getSettings().snappingOffset);
                    }
                    else{
                        this.get(i).getSettings().setSettings(undefined, undefined, undefined, false, this.name+"_"+i, "Same as previous", 200);
                    }
                break;
            }
        }            
    }
    
}

function processMouseMove(event){
    if(global.draggedMatch){
        snapToGridPreview(event);
        return;
    }
    else if(draggedConnector.isActive() && !draggedConnector.snapped){
        moveDraggedLine(event);
    }
        
}

function section_collapse(event){
    event.target.closest(".section_control_icon").classList.toggle("collapsed");
    console.log(event.target);
    event.target.closest("section.tournament_subdivision").classList.toggle("section_collapsed");
}

function section_delete(event){
    matchesPositions.get(event.target.closest(".tournament_subdivision").dataset.sectionname).delete(true);
}

function moveDraggedLine(event){
    //tady vzit draggedconnector, kouknout do jeho dat a upravit jeho konec na pozici mysi
    //const rect = dragActiveMatchesGrid.getBoundingClientRect();
    const rect= matchesPositions.get(draggedConnector.match.getPosition().sectionName).getGrid().getBoundingClientRect();
    console.log(rect, rect.left);

    //console.log(event.pageY, document.documentElement.scrollTop, rect, dragActiveMatchesGrid.parentElement.scrollTop)
    if(draggedConnector.connector.line.id === "tmpConnector")
        modifyLine("tmpConnector", draggedConnector.startingPointX, draggedConnector.startingPointY, event.pageX - rect.left, event.pageY - document.documentElement.scrollTop - rect.y);
    else{
        modifyLine(draggedConnector.connector.generatedId, draggedConnector.startingPointX, draggedConnector.startingPointY, event.pageX - rect.left, event.pageY - document.documentElement.scrollTop - rect.y);
    }
    
}

function snapToGridPreview(event){
    if(!global.draggedMatch)
        return;
    let snapY;
    
    //let rect = dragActiveMatchesGrid.getBoundingClientRect();
    const positions = getMatchPosition(global.draggedMatch);
    const rect = matchesPositions.get(positions.sectionName).getGrid();
    let snapX = matchesPositions.get(positions.sectionName).isLocked() ? positions.roundIndex*CONSTANT.columnSnapPx : (Math.floor((event.pageX + rect.parentElement.scrollLeft)/CONSTANT.columnSnapPx)*CONSTANT.columnSnapPx);

    let columnIndex = Number(snapX/CONSTANT.columnSnapPx);
    
    if(columnIndex >= matchesPositions.get(positions.sectionName).count()){
        console.log("column index set to last");
        columnIndex = matchesPositions.get(positions.sectionName).count() -1;
    }
    const m = matchesPositions.get(positions.sectionName).get(positions.roundIndex).getMatch(positions.matchOffset);
    if(!m.canBeMovedToRound(columnIndex)){
        console.log(m, "drag blocked due to connectors being attached");
        return;
    }

    //let column = rect.querySelector(`.round_column[data-round='${columnIndex+1}']`);
    let column = matchesPositions.get(positions.sectionName).get(columnIndex).element;
    let snappingMode = getColumnSnappingMode(positions.sectionName, columnIndex);
    
    const matchSnapPx = matchesPositions.get(positions.sectionName).get(columnIndex).getSettings().snappingOffset;
    const relativeMousePos = event.pageY - document.documentElement.scrollTop - rect.getBoundingClientRect().y;
    console.log("SNAPPING", snappingMode, m, columnIndex, positions, matchSnapPx, relativeMousePos);
    snappingMode = matchesPositions.get(positions.sectionName).get(columnIndex).getSettings().snappingMode;
    switch(snappingMode){
        case "Elimination": //fall through
        case "Same as previous": //fall through
        //half the number of the matches - solved with the snappingOffsetProperty
        case "Initial": 
            snapY = closestNumber(matchSnapPx/2 -global.draggedMatch.offsetHeight/2 -CONSTANT.matchVerticalGap/2, matchSnapPx, relativeMousePos -global.draggedMatch.offsetHeight/2);
            
            if(global.draggedMatch.parentElement.dataset.round != columnIndex+1){
                console.log("FOREIGN MATCH", columnIndex+1, global.draggedMatch.parentElement.dataset.round, snapY);
                if(isPositionOccupied(positions.sectionName, columnIndex, snapY)){
                    //pretahuje se tam, kam to nejde
                    console.log("CANT TRANSFER FROM COLUMN TO AN OCCUPIED POSITION");
                    return;
                }

                setMatchPosition(global.draggedMatch, columnIndex, snapY);
                
                column.appendChild(global.draggedMatch);                        
                break;
            }
            if(isPositionOccupied(positions.sectionName, columnIndex, snapY)){
                //tady se pretahuje v ramci stejneho sloupce
                snapY = parseFloat(global.draggedMatch.style.top, 10);

            }
            else{
                setMatchPosition(global.draggedMatch, positions.roundIndex, snapY);
            }
            break;
        case "Free":
            snapY = Number(snapYrect(relativeMousePos - global.draggedMatch.offsetHeight/2).toFixed(2));
            snapY = snapY<0? 0 :snapY;
            console.log("Free snapY", snapY, rect.offsetHeight);
            if(isPositionOccupied(positions.sectionName, columnIndex, snapY)){
                
                //same exact position as other match - map collision -> unexpected behaviour.
                return;
            }
            setMatchPosition(global.draggedMatch, columnIndex, snapY);
            if(global.draggedMatch.parentElement.dataset.round != columnIndex+1){
                console.log(global.draggedMatch.parentElement.dataset.round , columnIndex+1, rect, column)
                column.appendChild(global.draggedMatch);
            }
            break;
    }

    global.draggedMatch.style.top = snapY + "px";
    console.log("snapY calculated to ",snapY);
    
    const newPositions = getMatchPosition(global.draggedMatch);
    const match = matchesPositions.get(newPositions.sectionName).get(newPositions.roundIndex).getMatch(newPositions.matchOffset);
    for(let [id, c] of match.leftConnectors){
        c.recalculate(false, c.isRelegation());
    }
    match.rightConnector.recalculate();
    if(match.rightRelegationConnector){
        match.rightRelegationConnector.recalculate(false, true);   
    }
    //if(snapY + global.draggedMatch.offsetHeight >  dragActiveMatchesGrid.getBoundingClientRect().height - CONSTANT.matchesPaddingPx){
        adjustSectionCanvasHeight(newPositions.sectionName, snapY, true);
    //}
    //global.draggedMatch.style.left = round*roundWidthPx + "px";
}


function snapYrect(snapY){
    const rect = matchesPositions.get(getMatchPosition(global.draggedMatch).sectionName).getGrid();
    if(snapY < 0)
        snapY = 0;

    if(snapY > rect.offsetHeight - global.draggedMatch.offsetHeight){
        snapY = rect.offsetHeight - global.draggedMatch.offsetHeight;
    }
    return snapY;
}

function isPositionOccupied(sectionName, roundIndex, snapPx){
    if(matchesPositions.get(sectionName).get(roundIndex).getMatch(snapPx) !== undefined){
        return true;
    }
    return false;
}

function isSectionNameValid(nameToTest){
    if(nameToTest === undefined || nameToTest === null || nameToTest === ""){
        return false;
    }
    //TODO: we should probably also check if the section name already exists, if yes, do not allow.
    return true;
}

function roundHTML(roundNumber){
    let div = document.createElement("div");
    div.classList.add("round_column");
    div.dataset.round = roundNumber;
    return div;
}



export function snapModeChange(sectionName, roundIndex){
    console.log(sectionName, roundIndex);
    // Update snapping for this round and subsequent rounds
    matchesPositions.get(sectionName).updateSnapping(roundIndex);
}
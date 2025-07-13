import { matchesPositions, adjustSectionCanvasHeight, add_section } from "./tournaments.js";
import { setMatchPosition, Match } from "./match.js";
import { Team } from "./team.js";

const forwardHistorySteps = [];
let forwardHistoryStepsNo = 0;
export let latestHistoryChange = {};

class HistoryStack{
    constructor(){
        this.stack = [];
    }

    push(data){
        this.stack.push(data);
    }

    pop(){
        if (this.stack.length === 0)
            return 'Underflow';
        return this.stack.pop();
    }

    /*shift(){
        if (this.stack.length === 0)
            return 'Underflow';
        return this.stack.shift();
    }*/

    isEmpty()
    {
        return this.stack.length === 0;
    }

    seekFromEnd(i){
        return this.stack[this.stack.length - i -1];
    }

    seek(i){
        return this.stack[i];
    }

    loadStack(stack){
        this.stack = stack;
    }

    get length(){
        return this.stack.length;
    }

    reset(){
        this.stack = [];
    }

    // New method to find the next complete group
    findNextCompleteGroup(startIndex) {
        let totalSize = 0; // Total count of elements in the complete group
        let index = startIndex;
    
        while (index < this.stack.length) {
            let item = this.stack[index];
            totalSize++; // Count this element itself
            
            if (item.steps > 0) {
                let subgroupSize = 0;
                let nextIndex = index + 1;
                
                // Recursively process its next-level elements
                for (let i = 0; i < item.steps && nextIndex < this.stack.length; i++) {
                    let [subIndex, subSize] = this.findNextCompleteGroup(nextIndex);
                    subgroupSize += subSize;
                    nextIndex = subIndex + 1;
                }
                totalSize += subgroupSize;
                index = nextIndex - 1;
            }
            
            // A complete group has been detected
            return [index, totalSize];
        }
        return [index, totalSize];
    }

    findLastCompleteGroup() {
        let index = 0;
        let lastGroup = null;
    
        while (index < this.stack.length) {
            let [endIndex, groupSize] = this.findNextCompleteGroup(index);
            lastGroup = { start: index, size: groupSize };
            index = endIndex + 1;
        }
    
        return lastGroup;
    }
    

    findLastCompleteGroup() {
        let index = 0;
        let lastGroup = null;
    
        while (index < this.stack.length) {
            let [endIndex, groupSize] = this.findNextCompleteGroup(index);
            lastGroup = { start: index, size: groupSize };
            index = endIndex + 1;
        }
    
        return lastGroup;
    }
}

export const historyStack = new HistoryStack();
export const forwardStack = new HistoryStack();
window.forwardStack = forwardStack;

export function pushHistoryObject(){
    historyStack.push(latestHistoryChange);
    discardHistory();
    forwardStack.reset();   
}
export function discardHistory(){
    latestHistoryChange = {};
}



export function undo(direction = "backwards", steps = 0){
    //recursion parameter is a signal for bundling forward history steps, it doesnt have any other function
    console.log("UNDO CALLED with steps", steps);
    if(direction === "backwards" && historyStack.isEmpty())
        return;
    if(direction === "forwards" && forwardStack.isEmpty())
        return;

    let lastState = undefined;
    console.log("passed");
    if(direction === "backwards"){
        lastState = historyStack.pop();  
        console.log(historyStack, lastState);
        forwardStack.push(lastState);
        processHistoryState(lastState, direction, steps);
    }
    else if(direction === "forwards"){
        const group = forwardStack.findLastCompleteGroup();
        console.log("GROUP:", group);
        for(let i = 0; i< group.size; i++){
            const tmp = forwardStack.pop();
            console.log("pushing to history stack", tmp);
            //historyStack.push(tmp);
            lastState = reverseState(tmp); //pozor, klonovanim ztracime reference!!!!
            console.log(forwardStack, lastState);
            processHistoryState(lastState, direction, steps)
        }
    }
    else{
        return;
    }
}
    

function processHistoryState(lastState, direction = "backwards", steps = 0){

    const type = lastState.type;
    switch(type){
        case "delete_connector": {
            const sourceMatch = getMatchByString(lastState.source);
            const isRelegation = decodeIsConnectorRelegation(lastState.source);
            if(isRelegation && !sourceMatch.rightRelegationConnector){
                sourceMatch.enableRelegation();
            }
            const connector = isRelegation? sourceMatch.rightRelegationConnector :sourceMatch.rightConnector;
            console.log(connector);
            if(lastState.target){ // connector totiz muze byt nespojeny relegation connector
                const targetMatch = getMatchByString(lastState.target);
                connector.setRightMatch(targetMatch);
                targetMatch.leftConnectors.set(lastState.position, connector);
                console.log("source", sourceMatch, "target", targetMatch);
                lastState.position === "upper"? connector.right.getSettings().setTeam1(connector): connector.right.getSettings().setTeam2(connector);
                if(targetMatch.getPosition().sectionName !== sourceMatch.getPosition().sectionName)
                    connector.setExternal(true);
                connector.right.getLeftConnectingDotElement(connector.leftPositionString()).style.display = "block";
                connector.isRelegation()? connector.left.getRightRelegationConnectingDotElement().style.display = "block" : connector.left.getRightConnectingDotElement().style.display = "block";
                connector.right.updateTeams();
            }
            connector.recalculate(true, isRelegation);
            connector.left.getRound().getSection().highlightCollisions();
            if(connector.right && connector.left.getRound().getSection() !== connector.right.getRound().getSection())
                connector.right.getRound().getSection().highlightCollisions();
            break;
        }
        case "change_connector_left": { // tady je problem
            const targetMatch = getMatchByString(lastState.old);
            const sourceMatch = getMatchByString(lastState.source);
            const oldMatch = getMatchByPositions(decodeMatchString(lastState.target));
            const connector = decodeConnector(lastState.source);
            const isRelegation = decodeIsConnectorRelegation(lastState.source);
            console.log(oldMatch, sourceMatch, targetMatch);
            connector.delete(); // musi tu byt kvuli externim konektorum; jinak by se neodstranilo #part2       
            connector.setRightMatch(targetMatch);
            oldMatch.leftConnectors.delete(connector.generatedId);
            //connector.setLeftMatch(sourceMatch);
            targetMatch.leftConnectors.set(lastState.oldPosition, connector);
            connector.recalculate(true, isRelegation);
            lastState.position === "upper"? oldMatch.getSettings().setTeam1("Random"): oldMatch.getSettings().setTeam2("Random");
            lastState.oldPosition === "upper"? targetMatch.getSettings().setTeam1(connector): targetMatch.getSettings().setTeam2(connector);
            connector.right.getLeftConnectingDotElement(connector.leftPositionString()).style.display = "block";
            connector.isRelegation()? connector.left.getRightRelegationConnectingDotElement().style.display = "block" : connector.left.getRightConnectingDotElement().style.display = "block";
            targetMatch.updateTeams();
            oldMatch.updateTeams();
            connector.left.getRound().getSection().highlightCollisions();
            if(connector.left.getRound().getSection() !== connector.right.getRound().getSection())
                connector.right.getRound().getSection().highlightCollisions();
            break;
        }
        case "change_connector_right": {
            const targetMatch = getMatchByString(lastState.old); //nepotrebne
            const connector = decodeConnector(lastState.old);
            const sourceMatch = getMatchByString(lastState.source);
            const oldConnector = decodeConnector(lastState.target);
            const isRelegation = decodeIsConnectorRelegation(lastState.old);
            console.log(oldConnector, connector, sourceMatch, targetMatch, isRelegation);
            //connector.setLeftMatch(sourceMatch);
            oldConnector.delete();
            connector.setRightMatch(sourceMatch);
            sourceMatch.leftConnectors.set(lastState.oldPosition, connector);
            connector.recalculate(true, isRelegation);
            connector.left.getRound().getSection().highlightCollisions();
            if(connector.left.getRound().getSection() !== connector.right.getRound().getSection())
                connector.right.getRound().getSection().highlightCollisions();
            break;
        }
        case "new_connector_left": {
            const targetConnector = decodeConnector(lastState.target);
            targetConnector.left.getRound().getSection().highlightCollisions();
            targetConnector.delete();
            break;
        }
        case "new_connector_right": {
            const targetConnector = decodeConnector(lastState.source);
            targetConnector.left.getRound().getSection().highlightCollisions();
            targetConnector.delete();
            break;
        }
        case "move_match": {
            const source = decodeMatchString(lastState.source);
            const matchElement = getMatchByString(lastState.target).matchElement;
            console.log(matchElement);
            setMatchPosition(matchElement, source.roundIndex, source.matchOffset);
            matchesPositions.get(source.sectionName).get(source.roundIndex).element.appendChild(matchElement);
            matchElement.style.top = source.matchOffset + "px";
            const match = getMatchByPositions(source);
            match.rightConnector.recalculate();
            for(let [id, c] of match.leftConnectors){
                c.recalculate();
            }

            adjustSectionCanvasHeight(source.sectionName, source.viewportHeight, true);
            match.getRound().getSection().highlightCollisions();
            break;
        }
        case "delete_match": {
            let matchPositions;
            let lastOffset = undefined;
            console.log(lastState);
            if(Array.isArray(lastState.target)){
                for(const OffsetMatchIdPair of lastState.target){
                    //tato vetev se spousti kdyz je to zavolane z reverse state - jde o ciste pridani zapasu, bez nastaveni, pouze s urcitym identifikatorem
                    lastOffset = matchesPositions.get(lastState.section).get(lastState.roundIndex).createMatch(OffsetMatchIdPair[0], OffsetMatchIdPair[1]);
                    matchesPositions.get(lastState.section).get(lastState.roundIndex).getMatch(OffsetMatchIdPair[0]).updateTeams();
                }
                adjustSectionCanvasHeight(lastState.section, lastOffset);
            }
            else{
                matchPositions = decodeMatchString(lastState.target);
                lastOffset = matchesPositions.get(matchPositions.sectionName).get(matchPositions.roundIndex).createMatch(matchPositions.matchOffset, lastState.id);
                matchesPositions.get(matchPositions.sectionName).get(matchPositions.roundIndex).getMatch(matchPositions.matchOffset).getSettings().setSettings(lastState.settings.startTime, lastState.settings.format, false, lastState.settings.target, Match.getTeamReferenceFromString(lastState.settings.team1), Match.getTeamReferenceFromString(lastState.settings.team2));
                matchesPositions.get(matchPositions.sectionName).get(matchPositions.roundIndex).getMatch(matchPositions.matchOffset).updateTeams();
                adjustSectionCanvasHeight(matchPositions.sectionName, lastOffset);
            }
            break;
        }
        case "add_matches": {
            const round = matchesPositions.get(lastState.section).get(lastState.roundIndex);
            console.log(lastState, lastState.target);
            for(let matchPair of lastState.target){
                round.getMatch(matchPair[0]).delete();
                round.removeMatch(matchPair[0]);
            }
            adjustSectionCanvasHeight(lastState.section, lastState.viewportHeight-200, true);
            break;
        }
        case "add_round": {
            console.log(lastState.type, lastState.section, lastState.roundIndex, matchesPositions.get(lastState.section));
            console.log(matchesPositions);
            lastState.settings = matchesPositions.get(lastState.section).get(lastState.roundIndex).getSettings(); //Pozor, editujeme objekt, zmeny se propisuji dale. Je to zamyslene chovani.
            matchesPositions.get(lastState.section).get(lastState.roundIndex).delete();
            break;
        }
        case "delete_round": {
            matchesPositions.get(lastState.section).createNewRound(null, false, lastState.roundIndex);
            const settings = lastState.settings;
            console.log(settings);
            matchesPositions.get(lastState.section).get(lastState.roundIndex).getSettings().setSettings(settings.name, settings.startTime, settings.format, false, lastState.section+"_"+lastState.roundIndex, settings.snappingMode, settings.snappingOffset);
            console.log(matchesPositions.get(lastState.section).get(lastState.roundIndex).getSettings());
            //matchesPositions.get(lastState.section).setRoundName(lastState.roundIndex, lastState.settings.name);
            break;
        }
        case "round_settings_change": {
            const roundPosition = decodeRoundString(lastState.target);
            matchesPositions.get(roundPosition.sectionName).get(roundPosition.roundIndex).getSettings().setSettings(lastState.oldName, lastState.startTime, lastState.format, false, lastState.target);
            matchesPositions.get(roundPosition.sectionName).element.querySelector(`.tournament_legend .rounds_settings .round_setting[data-round="${roundPosition.roundIndex+1}"] input`).value = lastState.oldName;
            if(lastState.format !== lastState.newFormat){
                console.log(`Set ${lastState.oldName} format from ${lastState.newFormat} to ${lastState.format}`);
            }
            if(lastState.startTime !== lastState.newStartTime){
                console.log(`Set ${lastState.oldName} startTime from ${lastState.newStartTime} to ${lastState.startTime}`);
            }
            if(lastState.format !== lastState.newFormat || lastState.startTime !== lastState.newStartTime){ //something actually changed
                matchesPositions.get(roundPosition.sectionName).get(roundPosition.roundIndex).updateLegend();
            }
            break;
        }
        case "match_settings_change": {
            const matchPosition = decodeMatchString(lastState.target);
            matchesPositions.get(matchPosition.sectionName).get(matchPosition.roundIndex).getMatch(matchPosition.matchOffset).getSettings().setSettings(lastState.startTime, lastState.format, false, lastState.target, Match.getTeamReferenceFromString(lastState.team1), Match.getTeamReferenceFromString(lastState.team2));
            if(lastState.format !== lastState.newFormat){
                console.log(`Set ${lastState.target} format from ${lastState.newFormat} to ${lastState.format}`, lastState.format);
            }
            if(lastState.startTime !== lastState.newStartTime){
                console.log(`Set ${lastState.target} startTime from ${lastState.newStartTime} to ${lastState.startTime}`);
            }
            if(lastState.team1 !== lastState.newTeam1){
                console.log(`Set ${lastState.target} team1 from ${lastState.newTeam1} to `,lastState.team1, lastState.team1 instanceof Team);
            }
            if(lastState.team2 !== lastState.newTeam2){
                console.log(`Set ${lastState.target} team1 from ${lastState.newTeam2} to`, lastState.team2, lastState.team2 instanceof Team);
            }
            console.log(matchesPositions.get(matchPosition.sectionName).get(matchPosition.roundIndex).getMatch(matchPosition.matchOffset).getSettings());
            matchesPositions.get(matchPosition.sectionName).get(matchPosition.roundIndex).getMatch(matchPosition.matchOffset).updateTeams();
            break;
        }
        case "delete_section": {
            add_section(lastState.section, lastState.settings.order, false);
            break;
        }
        case "add_section": {
            console.log(lastState);
            matchesPositions.get(lastState.section).delete();
            break;
        }
        case "toggle_relegation": {
            const matchPosition = decodeMatchString(lastState.target);
            matchesPositions.get(matchPosition.sectionName).get(matchPosition.roundIndex).getMatch(matchPosition.matchOffset).enableRelegation();
            break;
        }
        case "modify_section": {
            matchesPositions.get(lastState.newName).setName(lastState.oldName);
            break;
        }

    }

    /*if(direction === "forwards"){
        historyStack.push(reverseState(lastState));
        for(let i = forwardStack.length-1; i >= 0; i--){
            console.log(i, forwardStack.seek(i), forwardStack.seek(i).steps, forwardStack.length);
            if(forwardStack.seek(i).steps && forwardStack.seek(i).steps + forwardStack.length - i >= forwardStack.length){
                if(i === 0){
                    console.log("calling final undo");
                    undo(direction, 0);
                    return;
                }
                for(let count = 0; count < i; count++){
                    console.log("calling undo from inner loop");
                    undo(direction, 0);
                }
                return;
            }
        }
        return;
    }*/
    if(direction === "forwards"){
        historyStack.push(reverseState(lastState));
        return;
    }
    if(lastState.steps){
        steps += lastState.steps;
    }
    if(--steps >= 0){
        undo(direction, steps);
    }
}

function reverseState(state){
    console.log("forwards process before state", state);


    let swapTargetSource = function(){
        if(state.target && state.source){
            const tmp = state.source;
            state.source = state.target;
            state.target = tmp;
        }
    }
    //v zazsobniku se podivame "dozadu" dokud nenajdeme neco s property steps. Pokud vzdalenost posledni polozky v zasobniku
    //odpovida steps pak vime ze se jedna o jeden krok a potrebujeme ho spojit. Jelikoz mame zasobnik od nejnovejsiho prirustku k nejstarsimu
    //tak steps presuneme na konec zasobniku a undo se postara o potrebny pocet kroku (tahle funkce bude zavolana x steps)
    /*if(state.steps){
        delete state["steps"];
    }
    for(let i = 0; i < forwardStack.length; i++){
        console.log(i, forwardStack.seekFromEnd(i).steps, forwardStack.seekFromEnd(i));
        if(forwardStack.seekFromEnd(i).steps && forwardStack.seekFromEnd(i).steps + forwardStack.length - i === forwardStack.length){
            console.log("true");
            state.steps = forwardStack.seekFromEnd(i).steps;
            break;
        }
    }*/
    switch(state.type){
        case "delete_connector": //OK
            state.type = "new_connector_right";
            break;
        case "change_connector_left":
            //state.type = "";
            console.log("change connector left swapping", state.old, "with", state.target);
            [state.old, state.target] = [state.target, state.old];
            [state.position, state.oldPosition] = [state.oldPosition, state.position];
            break;
        case "change_connector_right":
            //state.type = "";
            [state.old, state.target] = [state.target, state.old];
            break;
        case "new_connector_left": //OK
            swapTargetSource();
            state.type = "delete_connector";
            break;
        case "new_connector_right": //OK
            state.type = "delete_connector";
            break;
        case "move_match":
            //state.type = "";
            swapTargetSource();
            break;
        case "delete_match":
            state.type = "add_matches";
            //state.viewportHeight = ""; prevezme se puvodni
            console.log(state);
            console.log(state.target, (Array.isArray(state.target)), (Array.isArray(state.target))? state.target[0] : state.target);
            if(Array.isArray(state.target)){
                /*state.section = decodeMatchString(state.target[0]).sectionName;
                state.roundIndex = decodeMatchString(state.target[0]).roundIndex;
                state.matches = [];
                for(const val of state.target){ //tady neco
                    state.matches.push([decodeMatchString(val).matchOffset, ]);
                }*/
                break;
            }
            state.section = decodeMatchString(state.target).sectionName;
            state.roundIndex = decodeMatchString(state.target).roundIndex;
            state.target = [[decodeMatchString(state.target).matchOffset, state.id]];
            break;
        case "add_matches":
            state.type = "delete_match";
            //vytvorime stringy target matchu, v undo si je pak redundantne dekodujeme aby byl kod citelnejsi.
            //rozdil v undo bude akorat v chovani pro target = string a target = [string...]
            
            /*state.target = [];
            for(let val of state.target){
                state.target.push(state.section + "_" + state.roundIndex + "_" +  val);
            }
            delete state["matches"];*/
            break;
        case "add_round":
            state.type = "delete_round";
            break;
        case "delete_round": 
            state.type = "add_round";
            break;
        case "round_settings_change":
            [state.newName, state.oldName] = [state.oldName, state.newName];
            [state.newFormat, state.format] = [state.format, state.newFormat];
            [state.newStartTime, state.startTime] = [state.startTime, state.newStartTime];
            break;
        case "match_settings_change":
            [state.newFormat, state.format] = [state.format, state.newFormat];
            [state.newStartTime, state.startTime] = [state.startTime, state.newStartTime];
            [state.newTeam1, state.team1] = [state.team1, state.newTeam1];
            [state.newTeam2, state.team2] = [state.team2, state.newTeam2];
            break;
        case "delete_section":
            state.type = "add_section";
            break;
        case "add_section":
            state.type = "delete_section";
            break;
        case "modify_section":
            [state.oldName, state.newName] = [state.newName, state.oldName]
    }
    console.log("forwards process after state", state);
    return state;
}

function decodeMatchString(value){
    if(!value){
        alert("History is corrupted");
        return;
    }
    const split = value.split('_');
    if(split.length !== 3){
        alert("history is corrupted");
        return;
    }
    return {
        roundIndex: Number(split[1]),
        matchOffset: Number(split[2].replace("rel","")),
        sectionName: split[0]
        //relegation: split[2].endsWith("rel")? true : false //this is based on context, can be related to connector or false by default
    }
}

function decodeIsConnectorRelegation(matchOffset){
    return matchOffset.endsWith("rel")? true : false;
}

export function decodeConnector(value){
    const match = getMatchByString(value);
    const isRelegation = decodeIsConnectorRelegation(value);
    return isRelegation? match.rightRelegationConnector : match.rightConnector;
}

function decodeRoundString(value){
    const split = value.split('_');
    if(split.length !== 2){
        alert("history is corrupted");
        return;
    }
    return {
        roundIndex: Number(split[1]),
        sectionName: split[0]
    }
}

function getMatchByString(value){
    const decoded = decodeMatchString(value);
    console.log(decoded, matchesPositions.get(decoded.sectionName));
    return matchesPositions.get(decoded.sectionName).get(decoded.roundIndex).getMatch(decoded.matchOffset);
}

function getMatchByPositions(positions){
    return matchesPositions.get(positions.sectionName).get(positions.roundIndex).getMatch(positions.matchOffset);
}
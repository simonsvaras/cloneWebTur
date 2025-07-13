import { Match } from "./match.js";
import { pushHistoryObject, discardHistory, latestHistoryChange } from "./history.js";
import { matchesPositions, updateRoundList, closestNumber, addMatchToRound } from "./tournaments.js";
import { global } from "./global.js";
import * as CONSTANT from "./constants.js";

class RoundSettings{
    constructor(name, snappingOffset, snappingMode = "Free"){
        this.name = name;
        this.startTime = "ASAP";
        this.format = "1";
        this.snappingOffset = snappingOffset; //0=free
        this.snappingMode = snappingMode;
    }

    setName(name){
        this.name = name;
    }

    setSettings(name = undefined, startTime = undefined, format = undefined, history = false, identifier = false, snappingMode = undefined, snappingOffset = undefined){
        //identifier: "Sectionname_RoundIndex"
        if(history){
            latestHistoryChange.type = "round_settings_change";
            latestHistoryChange.target = identifier;
            latestHistoryChange.oldName = this.name;
            latestHistoryChange.startTime = this.startTime;
            latestHistoryChange.format = this.format;
            latestHistoryChange.newName = name ? name : this.name;
            latestHistoryChange.newStartTime = startTime? startTime : this.startTime;
            latestHistoryChange.newFormat = format? format : this.format;
            pushHistoryObject();
        }

        const sectionName = identifier.split("_")[0];
        const roundIndex = Number(identifier.split("_")[1]);

        this.name = name === undefined ? this.name : name;
        this.startTime = startTime === undefined ? this.startTime : startTime;
        this.format = format === undefined ? this.format : format;
        this.snappingMode = snappingMode === undefined ? this.snappingMode : snappingMode;
        this.snappingOffset = snappingOffset === undefined ? this.snappingOffset : snappingOffset;        

        document.querySelector(`.tournament_subdivision[data-sectionname="${sectionName}"] .tournament_legend .rounds_settings div:nth-of-type(${roundIndex+1}) .legend_round_name`).value = this.name;
        document.querySelector(`.tournament_subdivision[data-sectionname="${sectionName}"] .tournament_legend .rounds_settings div:nth-of-type(${roundIndex+1}) .legend_start`).textContent = this.startTime;
        document.querySelector(`.tournament_subdivision[data-sectionname="${sectionName}"] .tournament_legend .rounds_settings div:nth-of-type(${roundIndex+1}) .legend_format`).textContent = "BO" + this.format;
        document.querySelector(`.tournament_subdivision[data-sectionname="${sectionName}"] .tournament_legend .rounds_settings .round_setting[data-round="${roundIndex+1}"] .round_grid_snap`).value = this.snappingMode;
        console.log("IMPORTANT",document.querySelector(`.tournament_subdivision[data-sectionname="${sectionName}"] .tournament_legend .rounds_settings .round_setting[data-round="${roundIndex+1}"] .round_grid_snap`), document.querySelector(`.tournament_subdivision[data-sectionname="${sectionName}"] .tournament_legend .rounds_settings .round_setting[data-round="${roundIndex+1}"] .round_grid_snap`).value);
        if(format)
            RoundSettings.resetMatchesFormat(matchesPositions.get(sectionName).get(roundIndex));
        if(startTime)
            RoundSettings.resetMatcheStartTime(matchesPositions.get(sectionName).get(roundIndex));
    }

    static resetMatchesFormat(round){
        console.log("resetMatchesFormat", round.matches);
        for(const match of round.matches.values()){
            match.getSettings().format = undefined;
        }
    }
    static resetMatcheStartTime(round){
        console.log("resetMatchesFormat", round.matches);
        for(const match of round.matches.values()){
            match.getSettings().startTime = undefined;
        }
    }
}

export class Round {
    constructor(index, HTML, snappingOffset=0, name="", snappingMode = "Free"){
        this.element = HTML;
        this.matches = new Map();//key:offset, value: Match
        this.settings = new RoundSettings(name, snappingOffset, snappingMode);
        this._collisionLines = [];
        this._biggestMatchOffset = 0;
        HTML.closest(".tournament_subdivision").querySelector(`.round_setting[data-round="${index+1}"] .round_delete_button`).addEventListener("click", function(){this.delete(true)}.bind(this));
        HTML.closest(".tournament_subdivision").querySelector(`.round_setting[data-round="${index+1}"] .round_settings_button`).addEventListener("click", function(){this.openSettingsWidget(true)}.bind(this));
        HTML.closest(".tournament_subdivision").querySelector(`.round_setting[data-round="${index+1}"] .round_add_match_button`).addEventListener("click", function(){addMatchToRound(this.getSectionName(), this.getIndex())}.bind(this));
        HTML.closest(".tournament_subdivision").querySelector(`.round_setting[data-round="${index+1}"] .legend_round_name`).addEventListener("change", function(event){
            this.getSettings().setSettings(event.target.value, undefined, undefined, true, this.getSection().name+"_"+this.getIndex());
        }.bind(this))
    }

    addMatch(offset, match){
        this.matches.set(offset, match);
        if(offset > this._biggestMatchOffset)
            this._biggestMatchOffset = offset;
    }
    removeMatch(offset){
        this.matches.delete(offset);
        if(this.biggestMatchOffset == offset)
            this.updateBiggestOffset();
        
    }

    updateBiggestOffset(){
        this._biggestMatchOffset = 0;
        for(const moff of this.matches.keys()){
            if(moff > this._biggestMatchOffset)
                this._biggestMatchOffset = moff;
        }
    }

    getMatch(offset){
        return this.matches.get(offset);
    }

    getSettings(){
        return this.settings;
    }

    getSectionName(){
        console.log(this, this.element, this.element.parentElement);
        return this.element.parentElement.parentElement.parentElement.dataset.sectionname;
    }
    getSection(){
        return matchesPositions.get(this.getSectionName());
    }

    getIndex(){
        return Number(this.element.dataset.round)-1;
    }

    getStartX(){
        return this.getIndex()*CONSTANT.columnSnapPx;
    }

    recalculateMatches(){
        for(let match of this.matches.values()){
            console.log(match);
            match.recalculateConnectors();
        }
    }

    createMatch(forcedOffset = null, idOverride = undefined){
        //get the highest key //In the future: Enable user to choose if they want new matches at the end, or in the first free spot
        const highestKey = Math.max(...this.matches.keys());
        let snappingOffset = Number((this.getSettings().snappingOffset).toFixed(2));
        snappingOffset = snappingOffset === 0? 200 : snappingOffset;
        

        const html = document.getElementById("matchTemplate").content.cloneNode(true).firstElementChild;
        let offset;
        if(forcedOffset !== null)
            offset = forcedOffset;
        else
            offset = highestKey === -Infinity? closestNumber(snappingOffset/2 -CONSTANT.matchHeightPx/2 -CONSTANT.matchVerticalGap/2 ,snappingOffset, 0) : closestNumber(snappingOffset/2 -CONSTANT.matchHeightPx/2 -CONSTANT.matchVerticalGap/2 ,snappingOffset, highestKey+ snappingOffset); //idk why .toFixed(2) is needed but i encountered a .0000001 trailing so ...
        html.style.top = offset + "px";
        this.addMatch(offset, new Match(html, idOverride));
        
        this.element.appendChild(html);
        return offset;
    }

    delete(history = false, overrideRoundIndex = undefined){
        const sectionName = this.getSectionName();
        const roundIndex = this.getIndex();
        const matchesCount = this.matches.size;
        for(let m of this.matches.values()){
            m.delete(history, overrideRoundIndex? overrideRoundIndex : roundIndex);
        }
        
        const legends = this.element.parentElement.parentElement.parentElement.querySelector(".tournament_legend .rounds_settings");
        console.log(legends, roundIndex, legends.querySelector(`div[data-round="${roundIndex+1}"]`));
        legends.querySelector(`div[data-round="${roundIndex+1}"]`).remove();
        this.element.remove();
        reindexRounds(sectionName);
        
        let keysToShift = [];
        for (let key of matchesPositions.get(sectionName).keys()) {
            if (key > roundIndex) {
                keysToShift.push(key);
            }
        }
        // Delete the specified key
        matchesPositions.get(sectionName).deleteRound(roundIndex);

        // Shift the keys
        let position = roundIndex+2;
        const pattern = /^Round [1-9]\d*$/;
        console.log("shift keys", keysToShift);
        for (let key of keysToShift) {
            let value = matchesPositions.get(sectionName).get(key);
            matchesPositions.get(sectionName).deleteRound(key);
            matchesPositions.get(sectionName).set(key - 1, value);
            
            matchesPositions.get(sectionName).get(key - 1).recalculateMatches();//recalculate its connectors
            
            console.log("Testing round", position, "for match");
            console.log(matchesPositions.get(sectionName).get(key-1));
            const roundName = legends.querySelector(`div[data-round="${position}"] .legend_round_name`);
            //legends.querySelector(`div[data-round="${position}"]`).dataset.round = position-1;
            if(roundName && pattern.test(roundName.value)){
                roundName.value = "Round " + (position-1);
                matchesPositions.get(sectionName).setRoundName(key-1, "Round " + (position-1));
            }

            position++;
        }
        if(history){
            latestHistoryChange.type = "delete_round";
            latestHistoryChange.section = sectionName;
            latestHistoryChange.roundIndex = roundIndex;
            latestHistoryChange.steps = matchesCount;
            latestHistoryChange.settings = this.settings;
            pushHistoryObject();
        }
        updateRoundList(sectionName);
        matchesPositions.get(sectionName).updateSnapping(roundIndex);
    }

    openSettingsWidget(){
        global.roundWidget.open(this);
    }

    updateLegend(){
        /*const settings = this.getSettings();
        document.querySelector(`.tournament_subdivision[data-sectionname="${this.getSectionName()}"] .tournament_legend .rounds_settings div:nth-of-type(${this.getIndex()+1}) .legend_format`).textContent = "BO" + settings.format;
        document.querySelector(`.tournament_subdivision[data-sectionname="${this.getSectionName()}"] .tournament_legend .rounds_settings div:nth-of-type(${this.getIndex()+1}) .legend_start`).textContent = settings.startTime;*/
    }

    get biggestMatchOffset(){
        return this._biggestMatchOffset;
    }
}

function reindexRounds(sectionName){
    const rounds = document.querySelectorAll(`.tournament_subdivision[data-sectionName="${sectionName}"] .matches .round_column`);
    const legendSettings = document.querySelectorAll(`.tournament_subdivision[data-sectionName="${sectionName}"] .tournament_legend .rounds_settings .round_setting`);
    for(let i = 1; i <= rounds.length; i++){
        rounds[i-1].dataset.round = i;
        legendSettings[i-1].dataset.round = i;
    }
}
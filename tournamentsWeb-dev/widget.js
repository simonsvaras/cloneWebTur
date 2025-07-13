import * as CONSTANT from "./constants.js";
import {Team} from "./team.js";
import {select_advancing_team, teamWidgetSelectTeam} from "./tournaments.js";
import { removeContextMenu } from "./events.js";
import { Connector } from "./connector.js";




class Widget{
    constructor(element){
        this._widget = element;
        this._widget.querySelector(".widget_close").addEventListener("click", this.close.bind(this));
        this._widget.querySelector(".widget_blocker").addEventListener("click", this.close.bind(this));
        this._opened = false;
    }

    open(){
        this._opened = true;
        console.log("opening widget", this._widget);
        this._widget.classList.add("showing");
        removeContextMenu();
    }
    close(){
        console.log("closing the widget", this._widget);
        this._opened = false;
        this._widget.classList.remove("showing");
    }

    isOpened(){
        return this._opened;
    }
    
    updateSettings(){
        throw new Error("Not implemented");
    }

    static limitDateInput(input){
        let date = new Date(CONSTANT.loadedDate);
        input.min = date.toISOString().slice(0, -8);
        date.setMonth(date.getMonth()+1);
        input.value = date.toISOString().slice(0, -8);
        date.setMonth(date.getMonth()+23);
        input.max = date.toISOString().slice(0, -8);
    }
}

class RoundWidget extends Widget{
    constructor(element){
        super(element);
        this._round = undefined;
        this._previouslySelectedFormat = undefined;
        this._previouslySetTime = undefined;
        Widget.limitDateInput(this._widget.querySelector("#round_edit_widget_start_time"));
    }

    open(round){
        super.open();
        this._round = round;
        const settings = round.getSettings();
        this._widget.querySelector("#round_edit_round_id").textContent = settings.name;
        this._widget.querySelector("#round_edit_section_id").textContent = round.getSectionName();

        //Temporarily disable transition on the radio buttons so we can change it programatically without user noticing
        let oldFormatInput = this._widget.querySelector(`input[name='round_format']:checked`);
        let selectedFormatInput = this._widget.querySelector(`input[name='round_format'][value="${settings.format}"]`);
        let oldStartTimeInput = this._widget.querySelector(`input[name='round_start_type']:checked`);
        let selectedStartTimeInput = this._widget.querySelector(`input[name='round_start_type'][value="${settings.startTime}"]`);
        if(settings.startTime !== "ASAP"){
            selectedStartTimeInput = this._widget.querySelector(`input[name='round_start_type'][value="custom"]`);
        }
        
        [selectedFormatInput, oldFormatInput, selectedStartTimeInput, oldStartTimeInput].forEach((element) => element.parentElement.style.transition = 'none' );
        selectedFormatInput.checked = true;
        selectedStartTimeInput.checked = true;
        setTimeout(() => {
            [selectedFormatInput, oldFormatInput, selectedStartTimeInput, oldStartTimeInput].forEach((element) => element.parentElement.style.transition = '' );
        }, 1); //idk why this has to be delayed, probably some rendering optimalizations mess this up

        /*this section stores preselected values so the widget doesnt update when not desired to 
        (Set BO1 to BO3 and back to BO1 does not update the widget, otherwise it would set formats of all matches in the round
        to undefined, which is no intuitive).
        Also handled in this.updateSettings()*/
        this._previouslySelectedFormat = selectedFormatInput.value;
        this._previouslySetTime = selectedStartTimeInput.value;
        if(this._previouslySetTime === "custom"){
            this._widget.querySelector("#round_edit_widget_start_time").value = settings.startTime;
            this._previouslySetTime = settings.startTime;
        }
    }

    close(){
        let startTimeInput = this._widget.querySelector("#round_edit_widget_start_time");
        if(!startTimeInput.reportValidity()){
            return;
        }  

        this.updateSettings();
        super.close();
    }
    
    updateSettings(){
        //TODO: Rozdelit na format a cas, aby zmena formatu neprepsala zasy u jednotlivych zapasu!
        console.log("updating round settings from widget");
        let round_format = this._widget.querySelector('input[name="round_format"]:checked').value;
        let start_format = this._widget.querySelector('input[name="round_start_type"]:checked').value;
        const section_name = this._widget.querySelector("#round_edit_section_id").textContent;
        if(start_format === "custom")
            start_format = this._widget.querySelector("#round_edit_widget_start_time").value;
        console.log(start_format, this._previouslySetTime, round_format, this._previouslySelectedFormat);
        if(start_format === this._previouslySetTime)
            start_format = undefined;
        if(round_format === this._previouslySelectedFormat)
            round_format = undefined;
        if(start_format || round_format){
            this._round.getSettings().setSettings(undefined, start_format, round_format, true, section_name + "_" + this._round.getIndex());
            this._round.updateLegend();
        }
    }
}

class MatchWidget extends Widget{
    constructor(element){
        super(element);
        this._match = undefined;
        this._widget.querySelector("#select_team_promotion").addEventListener("click",(e)=> select_advancing_team(e, true));
        this._widget.querySelector("#select_team_relegation").addEventListener("click",(e)=> select_advancing_team(e, false));
        this._widget.querySelector("#team_random1").addEventListener("click", (e)=>teamWidgetSelectTeam(this._match, 'Random', e.target, 1));
        this._widget.querySelector("#team_random2").addEventListener("click", (e)=>teamWidgetSelectTeam(this._match, 'Random', e.target, 2));
        this._widget.querySelector("#team_TBD1").addEventListener("click", (e)=>teamWidgetSelectTeam(this._match, 'TBD', e.target, 1));
        this._widget.querySelector("#team_TBD2").addEventListener("click", (e)=>teamWidgetSelectTeam(this._match, 'TBD', e.target, 2));
        this._widget.querySelectorAll("input[name='match_edit_widget_format_select']").forEach((elem)=> elem.addEventListener("change", function (event){this.selectedFormat(event)}.bind(this)));
        /*this._widget.querySelectorAll("input[name='match_edit_widget_start_select']").forEach((elem)=> elem.addEventListener("change", function (event){this.selectedStarTime(event)}.bind(this)));
        this._widget.querySelector("#match_edit_widget_start_time").addEventListener("change", function(e){this.match.getSettings().startTime = e.target.value}.bind(this));*/
        this.populateTeamWidgets();
        Widget.limitDateInput(this._widget.querySelector("#match_edit_widget_start_time"));

        this._widget
            .querySelectorAll("input[name='match_edit_widget_start_select']")
            .forEach(elem =>
                elem.addEventListener("change", e => {
                    if (e.target.value === "fixed" && e.target.checked) {
                        // počkáme na zobrazení datepickeru, pak scroll
                        requestAnimationFrame(() => {
                            this._scrollContainer.scrollTo({
                                top: this._scrollContainer.scrollHeight,
                                behavior: "smooth"
                            });
                        });
                    }
                    this._refreshArrowVisibility();
                })
            );

        // Scroll container and arrow
        this._scrollContainer = this._widget.querySelector('.widget_content');
        this._arrow = document.createElement('div');
        this._arrow.classList.add('scroll-arrow');


        this._scrollContainer.appendChild(this._arrow);

        // Initial arrow visibility na next tick, až se DOM rozloží
        requestAnimationFrame(() => this._refreshArrowVisibility());

        // Při scrollu aktualizujeme visibility
        this._scrollContainer.addEventListener('scroll', () => this._refreshArrowVisibility());

        // Klik na šipku = plynulé scrollnutí dolů
        this._arrow.addEventListener('click', () => {
            this._scrollContainer.scrollTo({
                top: this._scrollContainer.scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    _refreshArrowVisibility() {
        const { scrollHeight, clientHeight, scrollTop } = this._scrollContainer;
        console.log(this._scrollContainer, scrollHeight, clientHeight, scrollTop);
        if (scrollHeight <= clientHeight) {
            // žádný scroll => žádná šipka
            this._arrow.style.display = 'none';
        } else {
            // je scroll => zobraz šipku
            this._arrow.style.display = '';
            this._arrow.style.opacity = scrollTop <= 0 ? '1' : '0';
        }
    }

        open(match){
        super.open();
            // vždy na začátku nahoře
            this._scrollContainer.scrollTop = 0;
            // a znovu na next tick, aby proběhly layouty
            requestAnimationFrame(() => this._refreshArrowVisibility());
        this._match = match;
        const settings = match.getSettings();
        const position = this.match.getPosition();
        this._widget.querySelector("#match_edit_widget_id").textContent = "#" + this.match.matchId + ", " +position.sectionName + " , " + this.match.getRound().getSettings().name;

        if(this._widget.querySelectorAll(".widget_select_scrollable .team_selected").length > 0){
            this._widget.querySelectorAll(".widget_select_scrollable .team_selected").forEach((element) => element.classList.remove("team_selected"));
        }

        const team_widget_1 = this._widget.querySelector(`#widget_team_selector1`);
        const team_widget_2 = this._widget.querySelector(`#widget_team_selector2`);
        if(settings.team1 instanceof Team){
            MatchWidget.teamWidgetSelectAndScroll(team_widget_1, settings.team1.id);
        }
        else if(settings.team1 instanceof Connector){
            team_widget_1.classList.add("disabled");
            team_widget_1.scrollTop = 0;
        }
        else{
            MatchWidget.teamWidgetSelectAndScroll(team_widget_1, settings.team1);//tady to je "Random"/"TBD" (true)
        }

        if(settings.team2 instanceof Team){
            MatchWidget.teamWidgetSelectAndScroll(team_widget_2, settings.team2.id);
        }
        else if(settings.team2 instanceof Connector){
            team_widget_2.classList.add("disabled");
            team_widget_2.scrollTop = 0;
        }
        else{
            MatchWidget.teamWidgetSelectAndScroll(team_widget_2, settings.team2);//tady to je "Random"/"TBD" (true)
        }

        if(this.match.rightConnector.right){
            this._widget.querySelector("#select_team_promotion").textContent = "#" + this.match.rightConnector.right.matchId;
        }
        else{
            this._widget.querySelector("#select_team_promotion").textContent = "SELECT";
        }
        if(this.match.rightRelegationConnector && this.match.rightRelegationConnector.right){
            this._widget.querySelector("#select_team_relegation").textContent = "#" + this.match.rightRelegationConnector.right.matchId;
        }
        else{
            this._widget.querySelector("#select_team_relegation").textContent = "SELECT";
        }

        this._widget.querySelector(`input[name='match_edit_widget_format_select'][value="${settings.format}"]`).checked = true;
        const dateInput = this._widget.querySelector("#match_edit_widget_start_time");
        if(!["ASAP", "TBA"].includes(settings.startTime)){
            this._widget.querySelector(`input[name='match_edit_widget_start_select'][value="fixed"]`).checked = true;
            dateInput.value = settings.startTime;
            dateInput.disabled = false;
        }
        else{
            this._widget.querySelector(`input[name='match_edit_widget_start_select'][value="${settings.startTime}"]`).checked = true;
            dateInput.disabled = true;
        }
        this.toggleFormatMismatchWarning();
    }

    close(){
        let startTimeInput = this._widget.querySelector("#match_edit_widget_start_time");
        if(!startTimeInput.reportValidity()){
            return;
        }
        this.updateSettings();
        super.close();
    }

    updateSettings(){
        const settings = this.match.getSettings();
        console.log("updating match settings from match widget");
        let format = this._widget.querySelector('input[name="match_edit_widget_format_select"]:checked').value;
        let start_format = this._widget.querySelector('input[name="match_edit_widget_start_select"]:checked').value;
        if(start_format === "fixed")
            start_format = this._widget.querySelector("#match_edit_widget_start_select_fixed").value;
        console.log(start_format, settings.startTime, format, settings.format);
        let team1 = (this._widget.querySelector("#widget_team_selector1 .team_selected"))? this._widget.querySelector("#widget_team_selector1 .team_selected").dataset.teamid : settings.team1;
        let team2 = (this._widget.querySelector("#widget_team_selector2 .team_selected"))? this._widget.querySelector("#widget_team_selector2 .team_selected").dataset.teamid : settings.team2;
        if(format === settings.format)
            format = undefined;
        if(start_format === settings.startTime)
            start_format = undefined;
        if(team1 === settings.team1)
            team1 = undefined;
        if(team2 === settings.team2)
            team2 = undefined;
        console.log(start_format, format, team1, team2);
        if(start_format || format || team1 || team2){
            settings.setSettings(start_format, format, true, this.match.getHistoryName(), team1, team2);
        }
        this.match.updateTeams();
    }

    get match(){
        return this._match;
    }

    populateTeamWidgets(){
        const teamScrollableWidgets = this._widget.querySelectorAll(".widget_select_scrollable");
        console.log(teamScrollableWidgets);
        let widgetNumber = 1;
        for(let scrollable of teamScrollableWidgets){
            for(let team of CONSTANT.registeredTeams.values()){
                console.log(team);
                scrollable.insertAdjacentHTML("beforeend", `
                <div class="shrinkable" data-teamId="${team.id}">
                <img src="https://tropse.pro/files/img/tropse-user.png" onerror="this.onerror=null; this.src='https://tropse.pro/files/img/tropse-user.png'"><p>${team.name}</p>
                </div>
                `);
                console.log(scrollable.querySelector("div > div:last-child"));
                const tmp = widgetNumber;
                scrollable.querySelector("div > div:last-child").addEventListener("click", (e)=>teamWidgetSelectTeam(this._match, team.id, e.target, tmp));
            }
            widgetNumber++;
            scrollable.querySelector('.team_filter').addEventListener('input', function() {
                const filterText = this.value.toLowerCase();
                const teamDivs = scrollable.querySelectorAll('div[data-teamid]');
                teamDivs.forEach(function(div) {
                    const teamName = div.querySelector('p').textContent.toLowerCase();
                    if (teamName.includes(filterText)) {
                        div.style.display = null;
                    } else {
                        div.style.display = 'none';
                    }
                });
            });
        }
    }

    selectedFormat(e){
        //this.match.getSettings().format = e.target.value;
        //console.log("set format to ", this.match.getSettings().format);
        this.toggleFormatMismatchWarning(e.target.value);
    }
    selectedStarTime(e){
        console.log(e.target.value);
        if(["TBA", "ASAP"].includes(e.target.value)){
            this.match.getSettings().startTime = e.target.value;
        }
        else{
            this.match.getSettings().startTime = this._widget.querySelector("#match_edit_widget_start_time").value;
        }
        console.log("set time to ", this.match.getSettings().startTime);
    }

    static teamWidgetSelectAndScroll(scrollableWidget, teamIdDataAttribute) {
        const div = scrollableWidget.querySelector(`div[data-teamId="${teamIdDataAttribute}"]`);
        if (!div) return false;

        scrollableWidget.classList.remove("disabled");
        div.classList.add("team_selected");

        // center the item in its own scroll container
        const container = scrollableWidget;
        const itemTop    = div.offsetTop;
        const itemHeight = div.clientHeight;
        const viewHeight = container.clientHeight;

        // compute a scrollTop so that the div is centered
        const scrollTop = itemTop - (viewHeight - itemHeight) / 2;
        container.scrollTo({ top: scrollTop, behavior: "instant" });

        return true;
    }

    toggleFormatMismatchWarning(comparingVal = this.match.getSettings().format){
        console.log("comparing formats" ,comparingVal, this.match.getRound().getSettings().format);
        if(comparingVal !== this.match.getRound().getSettings().format){
            this._widget.querySelector("#bo_mismatch_icon").classList.add("showing");
        }
        else{
            this._widget.querySelector("#bo_mismatch_icon").classList.remove("showing");
        }
    }
}

export{RoundWidget, MatchWidget}
import * as CONSTANT from "./constants.js"; //muzeme odstranit az budou tymy pryc ze staticke mapy
export class Team{ //export jen kvuli tmp tymum v konstantach
    constructor(id, name, imageUrl){
        this.id = id;
        this.name = name;
        this.imageUrl = imageUrl;
    }

    static getTeamById(id){
        return CONSTANT.registeredTeams.get(Number(id));
    }
}
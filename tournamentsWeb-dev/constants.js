import {Team} from "./team.js";
export const loadedDate = new Date();
export const columnSnapPx = 450;
export const matchWidthPx = 300;
export const matchHeightPx = 150;
export const matchVerticalGap = 50;
export const matchesPaddingPx = 20;
export const matchesMinHeightPX = 800;
export const matchHalfFreeSpacePx = (columnSnapPx - matchWidthPx)/2;
export const connectorRadiusPx = 8;
export const registeredTeams = new Map(
    [   
    [1, new Team(1, "Navi", "")],
    [2, new Team(2, "Faze", "")],
    [3, new Team(3, "Astralis", "")],
    [4, new Team(4, "G2", "")],
    [5, new Team(5, "Team Liquid", "")],
    [6, new Team(6, "Fnatic", "")],
    [7, new Team(7, "Virtus.pro", "")],
    [8, new Team(8, "MIBR", "")],
    [9, new Team(9, "Ninjas in Pyjamas", "")],
    [10, new Team(10, "Envy", "")]
]);
export const connectorCollisionHighlightColors = [
  "#e1e1e1", //connector default color
    "#FF8A8A", // Medium Pink
  "#FFBF80", // Medium Peach
  "#FFFF80", // Medium Yellow
  "#80FF9E", // Medium Green
  "#80CFFF", // Medium Blue
  "#A780FF", // Medium Purple
  "#FF9F6E"  // Medium Orange
  ];

//export {loadedDate, registeredTeams, columnSnapPx, matchWidthPx, matchesPaddingPx, connectorRadiusPx,matchHalfFreeSpacePx, connectorCollisionHighlightColors, matchesMinHeightPX};

# Tournament Maker
A vanilla JavaScript based project aiming to provide user friendly interface for e-sport tournaments creation.

The development started in 2/2024 so the project is still in its early days.

# Usage
Everything in the project is made with user friendliness in mind, hiding no features. Despite this, here is an overview to give you a head-start

 - Each round can be named to your desire
 - You can add matches to rounds via the toolbox at the top
 - Each round can have its own snapping mode
 - Matches when dragged are snapped to their closest snapping position based on the snapping mode of the round
 - Moving matches between different rounds can be disabled with the lock icon in the top right
 - You can full screen the section by clicking an icon next to the lock
 - Logical connections between matches and round are made via connectors
 - You create a connector by pressing down your left mouse button on one of the blue circles on each match and dragging it to a different one where it should "snap"
 - If you are still holding your mouse1 down with the connector snapped, you can still snap it to a different match
 - You can select matches and connectors by clicking once at them - the only action you can do with the selected item is to delete it by pressing delete key (multiple selection is not supported atm)
 - While a connector is selected you can change one of its end by dragging out on the blue dot and connecting it to a different match.
 - You can add rounds by clicking the blue "+" button, delete them by pressing the corresponding trash icon at the very top of the round.
 - ..There is more you will explore...

# Examples
![Example small single elimination tournament](http://kaj.tropse.pro/tournament_maker_example1.png)
![Example default](http://kaj.tropse.pro/tournament_maker_example2.png)
![Example small single elimination tournament in fullscreen](http://kaj.tropse.pro/tournament_maker_example3.png)


# Experimental features

## Saving and loading configuration
Loading the last saved tournament is done automatically at the page load. However, this is experimental and by default the user should see a very basic predefined layout without any connectors. If you wish to enable this feature you can call

    generateJSON()
in your console. This will take a snapshot of the current stage of the tournament and save it to your *Local storage*
Keep in mind that there are limitations to this and the next time you load the page, the tournament might look a bit different. This mainly affects round snapping modes that may get desynchronized or just be different than what you set them to.

To delete your saved configuration, write the following line in your developer console

    localStorage.removeItem("savedPositions")

# Upcoming features

 - Extended round settings including default format and start time
 - Match settings, allowing to set teams for each map, override format and start time
 - New sections creation and removal of the existing ones
 - Multiple selection
 - Selection by area
 - Style selector (Space theme/Dark theme. Can now be set by toggling *space* class of body)
 - Condensed view (When editing large elimination tournament, condense previous round/s so connectors can be dragged without much scrolling and visual checks are easier for the user)
 - Templates for most used tournament types

# Example configuration
The following code will produce the same result as the first example when pasted in your developer console

    localStorage.setItem("savedPositions", `{"Section1":{"rounds":{"0":{"settings":{"name":"Round 1","snappingOffset":200},"matches":{"0":{"RightConnector":{"generatedId":"connector_1","connectedTo":"Section1_1_100"}},"200":{"RightConnector":{"generatedId":"connector_2","connectedTo":"Section1_1_100"}},"400":{"RightConnector":{"generatedId":"connector_3","connectedTo":"Section1_1_500"}},"600":{"RightConnector":{"generatedId":"connector_4","connectedTo":"Section1_1_500"}},"800":{"RightConnector":{"generatedId":"connector_5","connectedTo":"Section1_1_900"}},"1000":{"RightConnector":{"generatedId":"connector_6","connectedTo":"Section1_1_900"}},"1200":{"RightConnector":{"generatedId":"connector_7","connectedTo":"Section1_1_1300"}},"1400":{"RightConnector":{"generatedId":"connector_8","connectedTo":"Section1_1_1300"}}}},"1":{"settings":{"name":"Round 2","snappingOffset":400},"matches":{"100":{"RightConnector":{"generatedId":"connector_9","connectedTo":"Section1_2_300"},"LeftConnectors":{"connector_2":"Section1_0_200","connector_1":"Section1_0_0"}},"500":{"RightConnector":{"generatedId":"connector_10","connectedTo":"Section1_2_300"},"LeftConnectors":{"connector_4":"Section1_0_600","connector_3":"Section1_0_400"}},"900":{"RightConnector":{"generatedId":"connector_11","connectedTo":"Section1_2_1100"},"LeftConnectors":{"connector_6":"Section1_0_1000","connector_5":"Section1_0_800"}},"1300":{"RightConnector":{"generatedId":"connector_12","connectedTo":"Section1_2_1100"},"LeftConnectors":{"connector_8":"Section1_0_1400","connector_7":"Section1_0_1200"}}}},"2":{"settings":{"name":"Semi Finals","snappingOffset":800},"matches":{"300":{"RightConnector":{"generatedId":"connector_13","connectedTo":"Section1_3_700"},"LeftConnectors":{"connector_9":"Section1_1_100","connector_10":"Section1_1_500"}},"1100":{"RightConnector":{"generatedId":"connector_14","connectedTo":"Section1_3_700"},"LeftConnectors":{"connector_11":"Section1_1_900","connector_12":"Section1_1_1300"}}}},"3":{"settings":{"name":"Finals","snappingOffset":1600},"matches":{"700":{"RightConnector":{"generatedId":"connector_15"},"LeftConnectors":{"connector_13":"Section1_2_300","connector_14":"Section1_2_1100"}}}}}}}`)

# Live demo
Live demo of this application/webpage can be found [here](http://kaj.tropse.pro/tournaments)

# Kaj návrh bodovací tabulky
|Kategorie |popis|body| komentář|
|--|--|--|--
|Dokumentace| cíl projektu... |1|Komenářů není moc, ale snad vše vysvětleno v readme|
|HTML 5| | | |
|Validita| Validní použité HTML| 1| Validátor vyhazuje pouze warningy|
|Validita|Funguje v moderních prohlížečích| 2| Testovaný Chrome a Firefox|
|Sémantické značky|Správné použití|1|Všechno přes div, větší celky v section|
|Grafika SVG/Canvas||2|Sice přes JS, ale SVG hojně využito|
|Média||0|Řešeno jen přes JS, jinak v tomto projektu nedává smysl|
|Formulářové prvky||1|Formulářové prvky sice jsou, ale využité jednotlivě, ne ve formuláři, tudíž nešlo splnit vše|
|Offline aplikace||1|Zatím je stránka pouze offline, být online je nutné jen při prvním načtení (u live demo verze)|
|CSS||||
|Pokročilé selektory||1||
|Vendor prefixy||0|Nepoužíval jsem - ale mám za to, že je to tak lepší|
|CSS transformace||0| Nepoužito - nenašel jsem místo, kde by to dávalo smysl|
|CSS animace||2|Animace rámečku při kliknutí na zápas|
|Media queries||2| Tady bych si body nestrhával - stránka je vyloženě určená pro PC, jinde je uživatel sám proti sobě. Chová se to rozumně při menších rozměrech, ale vyložené optimalizace pro ně nejsou.|
|Javascript||||
|OOP přístup||2|Vydefinováno asi 5 tříd, i když bez dědičnosti, která zatím nedává moc smysl|
|Použití JS frameworku||0|Nepoužito|
|Použití pokročilých API|| 1-2|Využito LocalStorage viz Experimental features|
|Funkční historie||0|Projekt by si ji žádal, ale udělat to pořádně by prostě zabralo moc dlouho|
|Ovládání médií||1|JS přehraje zvuk při snapování konektorů|
|Offline aplikace||1|Nesplněno, ale aplikace je plně offline...|
|JS práce se SVG||2|Veškeré konektory jsou SVG, zde bych si dal klidně i víc :D, vyřešit to bylo opravdu náročné|
|Ostatní||||
|Kompletnost řešení||?|Je to úplný začátek mého projektu, budu na něm ještě hodně pracovat. Ale snad to splňuje většinu věcí, co jsem slíbil...|
|Estetické zpracování||2|Mně se to líbí :D|
|Celkem ||24-28/36|Jen návrh, za víc bych se samozřejmě nezlobil :D|

// ==UserScript==
// @name        Evolve TP autofleet
// @namespace   Violentmonkey Scripts
// @match       https://pmotschmann.github.io/Evolve/
// @version     1.2
// @author      Kelenius
// @license     MIT; https://spdx.org/licenses/MIT.html
// @description 28.11.2023, 14:27:20
// ==/UserScript==

/*
 * 1.0: Initial release.
 * 1.1: Now supports requesting resources from Volch's script.
 * 1.2: Now deploys ships only when needed and does not deploy is waiting for MR is faster, more UI info.
 */

/*
 * How to use with Volch's script:
 * 1) Enable autoFleet
 * 2) Under fleet settings: Ships to build - set to "None"
 * 3) Add a custom condition (ctrl-click "Ships to build"): Eval | typeof AutoTPFleet !== "undefined" ? AutoTPFleet.NeedResources : false | == | Boolean | true | Manual mode
 *
 * If you want to use Volch's script to send an explorer, do the following changes:
 * 1) Set ships to build to "Presets" instead of "None"
 * 2) Leave the condition as is
 * 3) Set Weighting on every location to 0
 */

AutoTPFleet = {};
AutoTPFleet.TickRate = 5000;
AutoTPFleet.NeedResources = false;
AutoTPFleet.LocationStatus = {};

// #region Settings

// Where to put which ships and in what order. NOTE: SAME TYPE IS NOT CUMULATIVE! 1 scout then 2 scouts on the same location will put 2, not 3
AutoTPFleet.DesiredShips = [
  {targ: "spc_eris", ships: {scoutEris: 2}, reqRelay: true, allowSkip: true}, // Very far and just needs 50+ scanning, send ASAP

  {targ: "spc_enceladus", ships: {scoutCombat: 2, frigateFast: 1}}, // Secure quantium
  {targ: "spc_moon", ships: {scoutCombat: 2, frigate: 1}}, // Secure iridium
  {targ: "spc_belt", ships: {scoutCombat: 2, frigate: 1}}, // Iridium and elerium
  {targ: "spc_red", ships: {scoutCombat: 2, frigate: 1}}, // Secure titanium
  {targ: "spc_gas", ships: {scoutCombat: 2, frigate: 1}},

  {targ: "spc_titan", ships: {scoutCombat: 2}},
  {targ: "spc_triton", ships: {scoutCombat: 2}},
  {targ: "spc_kuiper", ships: {scoutCombat: 2}},

  {targ: "spc_gas_moon", ships: {scoutCombat: 2, frigate: 1}},

  {targ: "spc_titan", reqRelay: true, ships: {cruiser: 1, cruiserFast: 1}}, // Adamantite for cruisers
  {targ: "spc_enceladus", reqRelay: true, ships: {cruiserFast: 1}},
  {targ: "spc_triton", reqRelay: true, ships: {cruiserFast: 1}},
  {targ: "spc_kuiper", reqRelay: true, ships: {destroyer: 1, cruiserFast: 2}},
  {targ: "spc_triton", reqRelay: true, ships: {battlecruiserFast: 2}},
]

AutoTPFleet.GetBlueprint = function (shipType) {
  switch (shipType) {
    case "reset": return {class: "corvette", power: "solar", weapon: "railgun", armor: "steel", engine: "ion", sensor: "visual"};

    case "scoutEris": return {class: "corvette", power: "fusion", weapon: "railgun", armor: "alloy", engine: "vacuum", sensor: "lidar"};
    case "scoutCombat": return {class: "corvette", power: "elerium", weapon: "disruptor", armor: "neutronium", engine: "ion", sensor: "quantum"};

    case "frigate": return {class: "frigate", power: "fission", weapon: "disruptor", armor: "neutronium", engine: "ion", sensor: "visual"};
    case "frigateFast": return {class: "frigate", power: "elerium", weapon: "disruptor", armor: "neutronium", engine: "photon", sensor: "visual"};

    case "destroyer": return {class: "destroyer", power: "fission", weapon: "disruptor", armor: "neutronium", engine: "ion", sensor: "visual"};
    case "destroyerFast": return {class: "destroyer", power: "elerium", weapon: "disruptor", armor: "neutronium", engine: "photon", sensor: "visual"};

    case "cruiser": return {class: "cruiser", power: "fusion", weapon: "disruptor", armor: "neutronium", engine: "ion", sensor: "visual"};
    case "cruiserFast": return {class: "cruiser", power: "elerium", weapon: "disruptor", armor: "neutronium", engine: "tie", sensor: "visual"};

    case "battlecruiser": return {class: "battlecruiser", power: "fusion", weapon: "disruptor", engine: "ion", armor: "neutronium", sensor: "visual"};
    case "battlecruiserFast": return {class: "battlecruiser", power: "elerium", weapon: "disruptor", engine: "pulse", armor: "neutronium", sensor: "visual"};

    case "dreadnought": return {class: "dreadnought", armor: "neutronium", weapon: "disruptor", engine: "ion", power: "fusion", sensor: "visual"};
  }
}

// #endregion

// #region Game data

/*
Max threat:
spc_titan: 2000
spc_enceladus: 1500
spc_triton: 5000
spc_kuiper: 2500
spc_eris: 7500
all others: 500

triton_mission sets spc_triton to 1250, adds 250 to spc_titan and spc_enceladus
kuiper_mission sets spc_kuiper to 500
eris_mission sets spc_eris to 4000
tech-data_analysis adds 500 to spc_titan, 250 to spc_enceladus, 1000 to spc_triton

1/10 chance to grow by 1 every day, 1/5 for spc_triton
*/

// https://github.com/pmotschmann/Evolve/blob/master/src/truepath.js#L3677
AutoTPFleet.shipConfig = {
    class: ['corvette','frigate','destroyer','cruiser','battlecruiser','dreadnought','explorer'],
    power: ['solar','diesel','fission','fusion','elerium'],
    weapon: ['railgun','laser','p_laser','plasma','phaser','disruptor'],
    armor : ['steel','alloy','neutronium'],
    engine: ['ion','tie','pulse','photon','vacuum','emdrive'],
    sensor: ['visual','radar','lidar','quantum'],
};

// https://github.com/pmotschmann/Evolve/blob/master/src/truepath.js#4820
AutoTPFleet.spacePlanetStats = {
    spc_sun: { dist: 0, orbit: 0, size: 2 },
    spc_home: { dist: 1, orbit: -1, size: 0.6 },
    spc_moon: { dist: 1.01, orbit: -1, size: 0.1, moon: true },
    spc_red: { dist: 1.524, orbit: 687, size: 0.5 },
    spc_hell: { dist: 0.4, orbit: 88, size: 0.4 },
    spc_venus: { dist: 0.7, orbit: 225, size: 0.5 },
    spc_gas: { dist: 5.203, orbit: 4330, size: 1.25 },
    spc_gas_moon: { dist: 5.204, orbit: 4330, size: 0.2, moon: true },
    spc_belt: { dist: 2.7, orbit: 1642, size: 0.5, belt: true },
    spc_dwarf: { dist: 2.77, orbit: 1682, size: 0.5 },
    spc_saturn: { dist: 9.539, orbit: 10751, size: 1.1 },
    spc_titan: { dist: 9.536, orbit: 10751, size: 0.2, moon: true },
    spc_enceladus: { dist: 9.542, orbit: 10751, size: 0.1, moon: true },
    spc_uranus: { dist: 19.8, orbit: 30660, size: 1 },
    spc_neptune: { dist: 30.08, orbit: 60152, size: 1 },
    spc_triton: { dist: 30.1, orbit: 60152, size: 0.1, moon: true },
    spc_kuiper: { dist: 39.5, orbit: 90498, size: 0.5, belt: true },
    spc_eris: { dist: 68, orbit: 204060, size: 0.5, size: 0.5 },
    tauceti: { dist: 752568.8, orbit: -2, size: 2 },
};
// orbit - how long it takes to rotate 360 degrees, in days
// dist - distance from the sun, before ellipse is applied
// current position is in evolve.global.space.position
// 0 is on the right, 90 is on the botom, 180 is on the left, 270 is at the top

// #endregion

AutoTPFleet.GetRegionThreat = function (region) {
  if (!evolve.global.space.syndicate.hasOwnProperty(region)) {
    return {patrol: 0, piracy: -1, max: -1};
  }
  let matching = evolve.global.space.shipyard.ships.filter(x => x.location == region);
  let patrol = 0; let sensor = 0;
  for (let ship of matching) {
    patrol += AutoTPFleet.GetShipStats(ship).attackPower;
    sensor += AutoTPFleet.GetShipStats(ship).sensors;
  }

  if (region == "spc_enceladus" && evolve.global.space.operating_base?.on > 0) {
    patrol += evolve.global.space.operating_base.on * 50;
  }
  if (region == "spc_titan" && evolve.global.space.sam?.on > 0) {
    patrol += evolve.global.space.sam.on * 25;
  }
  if (region == "spc_triton" && evolve.global.space.fob?.on > 0) {
    patrol += 500;
    sensor += 10;
  }

  if (sensor > 100){
    sensor = Math.round((sensor - 100) / ((sensor - 100) + 200) * 100) + 100;
  }
  patrol = Math.round(patrol * ((sensor + 25) / 125));
  let piracy = evolve.global.space.syndicate[region];

  let max = 500;
  switch(region) {
    case "spc_titan":
      max = 2000;
      break;
    case "spc_enceladus":
      max = 1500;
      break;
    case "spc_triton":
      max = 5000;
      divisor = 5;
      break;
    case "spc_kuiper":
      max = 2500;
      break;
    case "spc_eris":
      max = 7500;
      break;
  }

  return {patrol: patrol, piracy: piracy, max: max};
}

AutoTPFleet.GetRegionPredictedThreat = function (region, days) {
  let ret = AutoTPFleet.GetRegionThreat(region);

  let divisor = 10;

  let predThreat = ret.piracy + days / divisor;
  if (!evolve.global.tech.triton && (region == "spc_titan" || region == "spc_enceladus")) {
    predThreat += 250;
  }
  if (!evolve.global.tech.outer || evolve.global.tech.outer < 4) {
    if (region == "spc_titan") predThreat += 500;
    if (region == "spc_enceladus") predThreat += 250;
    if (region == "spc_triton") predThreat += 1000;
  }
  if (predThreat > ret.max) {
    predThreat = ret.max;
  }
  ret.piracy = Math.ceil(predThreat);
  return ret;
}

AutoTPFleet.GetShipTotals = function (ships, patrol = 0, sensor = 0) {
  for (let shipType in ships) {
    let ship = AutoTPFleet.GetBlueprint(shipType);
    patrol += AutoTPFleet.GetShipStats(ship).attackPower * ships[shipType];
    sensor += AutoTPFleet.GetShipStats(ship).sensors * ships[shipType];
  }
  if (sensor > 100){
    sensor = Math.round((sensor - 100) / ((sensor - 100) + 200) * 100) + 100;
  }
  let intel = ((sensor + 25) / 125);
  patrol = Math.round(patrol * intel);
  return {patrol: patrol, intel: intel, sensor: sensor}
}

AutoTPFleet.GetBounds = function (targ) {
  if (!AutoTPFleet.spacePlanetStats[targ]) return;
  let dist = AutoTPFleet.spacePlanetStats[targ].dist;
  let xMult;
  let xAdd = dist / 3;

  if (evolve.global.city.ptrait.includes("elliptical")) {
    if (targ == "spc_home") {
      xMult = 1.5;
      xAdd += 0.15;
    }
    else {
      xMult = 1.275 + dist / 100;
    }
  }
  else {
    xMult = 1.075 + dist / 100;
  }
  if (targ == "spc_eris") {
    xAdd += 25;
  }

  return {minY: -dist, maxY: dist, minX: -(dist * xMult) + xAdd, maxX: dist * xMult + xAdd};
}

AutoTPFleet.GetDistances = function (orig, targ) {
  if (!AutoTPFleet.spacePlanetStats[orig] || !AutoTPFleet.spacePlanetStats[targ]) return;
  let closer, further;
  if (AutoTPFleet.spacePlanetStats[orig].dist <= AutoTPFleet.spacePlanetStats[targ].dist) {
    [closer, further] = [orig, targ];
  }
  else {
    [closer, further] = [targ, orig];
  }

  let closerBounds = AutoTPFleet.GetBounds(closer);
  let furtherBounds = AutoTPFleet.GetBounds(further);

  let maxDist = Math.abs(furtherBounds.maxX) + Math.abs(closerBounds.minX);
  let minDist = Math.abs(furtherBounds.minX) - Math.abs(closerBounds.minX);

  return {min: minDist, max: maxDist, avg: (minDist + maxDist) / 2};
}

AutoTPFleet.GetMassDriverChargeDays = function () {
  if (!evolve.global.space.m_relay) {
    return -1;
  }
  if (evolve.global.space.m_relay.charged >= 10000) {
    return 0;
  }
  return Math.ceil((10000 - evolve.global.space.m_relay.charged) / 20);
}

// Speed: https://github.com/pmotschmann/Evolve/blob/master/src/truepath.js#4079
// Attack power: https://github.com/pmotschmann/Evolve/blob/master/src/truepath.js#4038
// Sensors: https://github.com/pmotschmann/Evolve/blob/master/src/truepath.js#4714
AutoTPFleet.GetShipStats = function (ship) {
  let mass;
  let momentum;
  let sensorBase = 1;
  let sensors;
  let attackBase = 1;
  let weapons;
  let powerGenMod = 1;
  let powerUseMod = 1;
  let powerUseBase = 0;
  let powerGenBase = 0;
  switch (ship.class){
    case 'corvette':
      mass = ship.armor === 'neutronium' ? 1.1 : 1;
      sensorBase = 2;
      break;
    case 'frigate':
      mass = ship.armor === 'neutronium' ? 1.35 : 1.25;
      sensorBase = 2;
      attackBase = 1.5;
      powerGenMod = 1.1;
      powerUseMod = 1.2;
      break;
    case 'destroyer':
      mass = ship.armor === 'neutronium' ? 1.95 : 1.8;
      sensorBase = 1.5;
      attackBase = 2.75;
      powerGenMod = 1.5;
      powerUseMod = 1.65;
      break;
    case 'cruiser':
      mass = ship.armor === 'neutronium' ? 3.5 : 3;
      sensorBase = 1.5;
      attackBase = 5.5;
      powerGenMod = 2;
      powerUseMod = 2.5;
      break;
    case 'battlecruiser':
      mass = ship.armor === 'neutronium' ? 4.8 : 4;
      attackBase = 10;
      powerGenMod = 2.5;
      powerUseMod = 3.5;
      break;
    case 'dreadnought':
      mass = ship.armor === 'neutronium' ? 7.5 : 6;
      attackBase = 22;
      powerGenMod = 5;
      powerUseMod = 6.5;
      break;
    case 'explorer':
      mass = 1;
      sensorBase = 5;
      attackBase = 1.2;
      powerGenMod = 6;
      powerUseMod = 2;
      break;
  }
  switch (ship.power) {
    case 'solar':
      powerGenBase = 50;
      break;
    case 'diesel':
      powerGenBase = 100;
      break;
    case 'fission':
      powerGenBase = 150;
      break;
    case 'fusion':
      powerGenBase = 175;
      break;
    case 'elerium':
      powerGenBase = 200;
      break;
  }
  switch (ship.engine){
    case 'ion':
      momentum = 12;
      powerUseBase += 25;
      break;
    case 'tie':
      momentum = 22;
      powerUseBase += 50;
      break;
    case 'pulse':
      momentum = 18;
      powerUseBase += 40;
      break;
    case 'photon':
      momentum = 30;
      powerUseBase += 75;
      break;
    case 'vacuum':
      momentum = 42;
      powerUseBase += 120;
      break;
    case 'emdrive':
      momentum = 37500;
      powerUseBase += 515;
      break;
  }
  switch (ship.sensor) {
    case 'visual':
      sensors = 1;
      break;
    case 'radar':
      sensors = 10 * sensorBase;
      powerUseBase += 10;
      break;
    case 'lidar':
      sensors = 18 * sensorBase;
      powerUseBase += 25;
      break;
    case 'quantum':
      sensors = 32 * sensorBase;
      powerUseBase += 75;
      break;
  }
  switch (ship.weapon) {
    case 'railgun':
      weapons = 36 * attackBase;
      powerUseBase += 10;
      break;
    case 'laser':
      weapons = 64 * attackBase;
      powerUseBase += 30;
      break;
    case 'p_laser':
      weapons = 54 * attackBase;
      powerUseBase += 18;
      break;
    case 'plasma':
      weapons = 90 * attackBase;
      powerUseBase += 50;
      break;
    case 'phaser':
      weapons = 114 * attackBase;
      powerUseBase += 65;
      break;
    case 'disruptor':
      weapons = 156 * attackBase;
      powerUseBase += 100;
      break;
  }

  return {speed: momentum / mass, sensors: sensors, attackPower: weapons, power: powerGenBase * powerGenMod - powerUseBase * powerUseMod}
}

AutoTPFleet.GetShipDeployTime = function (ship, target) {
  let distance = AutoTPFleet.GetDistances("spc_dwarf", target).avg;
  let speed = AutoTPFleet.GetShipStats(ship).speed;
  return Math.ceil(distance * 225 / speed);
}

AutoTPFleet.MainLoop = function () {
  AutoTPFleet.NeedResources = false;
  if (!evolve?.global?.space?.shipyard?.ships || !document.getElementById("shipPlans")) {
    AutoTPFleet.UpdateInfoDiv("OFF", "Not on true path or doesn't have the shipyard.");
    setTimeout(AutoTPFleet.MainLoop, AutoTPFleet.TickRate);
    return;
  }
  if (evolve.global.space.shipyard.blueprint.class == "explorer") {
    AutoTPFleet.SetBlueprint(AutoTPFleet.GetBlueprint("reset"), true);
    AutoTPFleet.UpdateInfoDiv("XPL", "Blueprint was set to explorer, resetting.", true);
    setTimeout(AutoTPFleet.MainLoop, AutoTPFleet.TickRate);
    return;
  }
  let nextShip = AutoTPFleet.GetNextShip();
  if (!nextShip) {
    AutoTPFleet.UpdateInfoDiv("DONE", "All ships deployed.", true);
  }
  else if (nextShip.action == "scrap") {
    evolve.messageQueue(`Scrapping ${nextShip.shipType} (${evolve.global.space.shipyard.ships[nextShip.shipId].name}) at ${AutoTPFleet.GetPlanetName(nextShip.targ)}`);
    AutoTPFleet.ScrapShip(nextShip.shipId);
    AutoTPFleet.UpdateInfoDiv("...", "Just scrapped a ship, waiting for the next tick.", true);
  }
  else if (nextShip.action == "build") {
    let bprint = AutoTPFleet.GetBlueprint(nextShip.shipType);
    if (!AutoTPFleet.ShipBuildable(bprint)) {
      AutoTPFleet.UpdateInfoDiv("TECH", `Missing tech for ${nextShip.shipType} to ${AutoTPFleet.GetPlanetName(nextShip.targ)}`, true);
    }
    else {
      let missing = AutoTPFleet.CheckMissingShipResources(bprint);
      if (missing.length) {
        AutoTPFleet.SetBlueprint(bprint);
        AutoTPFleet.NeedResources = true;
        AutoTPFleet.UpdateInfoDiv("RES", `Waiting for [${missing.join(", ")}] for ${nextShip.shipType} to ${AutoTPFleet.GetPlanetName(nextShip.targ)}`, true);
      }
      else {
        AutoTPFleet.BuildAndDeploy(bprint, nextShip.targ);
        evolve.messageQueue(`Ship ${nextShip.shipType} built and sent to ${AutoTPFleet.GetPlanetName(nextShip.targ)}`);
        AutoTPFleet.UpdateInfoDiv("...", "Just deployed a ship, waiting for the next tick.", true);
      }
    }
  }
  setTimeout(AutoTPFleet.MainLoop, AutoTPFleet.TickRate);
}

AutoTPFleet.GetNextShip = function () {
  let relayCharge = AutoTPFleet.GetMassDriverChargeDays();
  let massRelayBuilt = relayCharge !== -1;
  let massRelayCharged = relayCharge == 0;
  AutoTPFleet.LocationStatus = {};
  for (let request of AutoTPFleet.DesiredShips) {
    if (!evolve.actions.space[request.targ].info.syndicate()) continue;
    if (request.reqRelay && !massRelayBuilt) continue;
    if (request.ifCannot && AutoTPFleet.ShipBuildable(AutoTPFleet.GetBlueprint(request.ifCannot))) continue;
    if (request.reqSynd) {
      let cur = evolve.global.space.syndicate[request.targ];
      let max = evolve.actions.space[request.targ].info.syndicate_cap();
      if (cur / max < request.reqSynd) continue;
    }
    if (request.scrap) {
      for (let i = evolve.global.space.shipyard.ships.length - 1; i >= 0; --i) {
        if (evolve.global.space.shipyard.ships[i].location != request.targ) continue;
        for (let shipType of request.scrap) {
          let bprint = AutoTPFleet.GetBlueprint(shipType);
          if (AutoTPFleet.ShipMatchesBlueprint(evolve.global.space.shipyard.ships[i], bprint)) {
            return {action: "scrap", shipType: shipType, targ: request.targ, shipId: i};
          }
        }
      }
    }
    for (let shipType in request.ships) {
      let bprint = AutoTPFleet.GetBlueprint(shipType);
      if (!AutoTPFleet.ShipBuildable(AutoTPFleet.GetBlueprint(bprint)) && request.allowSkip) continue;
      let matching = evolve.global.space.shipyard.ships.filter(x => x.location == request.targ && AutoTPFleet.ShipMatchesBlueprint(x, bprint));
      if (matching.length < request.ships[shipType]) {
        let travelTime = AutoTPFleet.GetShipDeployTime(bprint, request.targ);
        if (massRelayCharged) {
          travelTime = Math.ceil(travelTime / 3);
        }
        else {
          if (massRelayBuilt) {
            let relayTravelTime = Math.ceil(relayCharge + travelTime / 3);
            if (relayTravelTime < travelTime) {
              if (!AutoTPFleet.LocationStatus[request.targ]) {
                AutoTPFleet.LocationStatus[request.targ] = `Waiting for Mass Relay to deploy ${shipType} (${relayTravelTime} vs ${travelTime} days).`;
              }
              continue;
            }
          }
        }

        let threatInfo = AutoTPFleet.GetRegionPredictedThreat(request.targ, travelTime);
        if (threatInfo.piracy < threatInfo.patrol) {
          if (!AutoTPFleet.LocationStatus[request.targ]) {
            AutoTPFleet.LocationStatus[request.targ] = `Waiting to deploy ${shipType} (${travelTime} travel days, predicted threat ${threatInfo.piracy}).`;
          }
          continue;
        }

        return {action: "build", shipType: shipType, targ: request.targ};
      }
    }
  }
}

AutoTPFleet.BuildAndDeploy = function (bprint, targ) {
  if (!AutoTPFleet.SetBlueprint(bprint)) {
    return;
  }
  if (AutoTPFleet.CheckMissingShipResources(bprint).length) {
    return;
  }
  let shipPlansVue = document.getElementById("shipPlans").__vue__;
  if (evolve.global.space.shipyard.sort) {
    $("#shipPlans .b-checkbox").eq(1).click();
    shipPlansVue.build();
    $("#shipReg0")[0].__vue__.setLoc(targ, evolve.global.space.shipyard.ships.length);
    $("#shipPlans .b-checkbox").eq(1).click();
  }
  else {
    shipPlansVue.build();
    $("#shipReg0")[0].__vue__.setLoc(targ, evolve.global.space.shipyard.ships.length);
  }
}

AutoTPFleet.ShipBuildable = function (bprint) {
  let shipPlansVue = document.getElementById("shipPlans").__vue__;
  for (let part in bprint) {
    let ind = AutoTPFleet.shipConfig[part].indexOf(bprint[part]);
    if (!shipPlansVue.avail(part, ind)) {
      return false;
    }
  }
  return true;
}

AutoTPFleet.CheckMissingShipResources = function (bprint) {
  let costs = evolve.shipCosts(bprint);
  let missing = [];
  for (let res of Object.keys(costs)) {
    if (costs[res] > evolve.global.resource[res].amount) {
      missing.push(res);
    }
  }
  return missing;
}

AutoTPFleet.SetBlueprint = function (bprint, force = false) {
  if (!force && !AutoTPFleet.ShipBuildable(bprint)) {console.log(`Tried to apply impossible blueprint: ${bprint}`); return false;}
  let shipPlansVue = document.getElementById("shipPlans").__vue__;
  for (let part in bprint) {
  if (evolve.global.space.shipyard.blueprint[part] != bprint[part]) {
      shipPlansVue.setVal(part, bprint[part]);
    }
  }
  return true;
}

AutoTPFleet.ScrapShip = function (id) {
  document.getElementById("shipReg0").__vue__.setLoc("spc_dwarf", id);
  document.getElementById("shipReg0").__vue__.scrap(id);
}

AutoTPFleet.GetPlanetName = function(id) {
  let locName = typeof(evolve.actions.space[id].info.name) == "string" ? evolve.actions.space[id].info.name : evolve.actions.space[id].info.name();
  return `${id} (${locName})`;
}

AutoTPFleet.ShipMatchesBlueprint = function(ship, bprint) {
  return (ship.class == bprint.class && ship.armor == bprint.armor && ship.weapon == bprint.weapon && ship.engine == bprint.engine && ship.power == bprint.power && ship.sensor == bprint.sensor);
}

AutoTPFleet.UpdateInfoDiv = function (state, text, showLocs) {
  if (!AutoTPFleet.InfoDiv) {
    AutoTPFleet.InfoDiv = document.createElement("span");
    $("span.calendar")[0].appendChild(AutoTPFleet.InfoDiv);
  }
  AutoTPFleet.InfoDiv.innerHTML = state;

  if (showLocs) {
    let divTitle = text + "\n";
    for (let loc of ["spc_moon", "spc_red", "spc_belt", "spc_gas", "spc_gas_moon", "spc_titan", "spc_enceladus", "spc_triton", "spc_kuiper", "spc_eris"]) {
      divTitle += `\n${AutoTPFleet.GetPlanetName(loc)}: ${AutoTPFleet.GetLocInfo(loc)}`;
    }
    AutoTPFleet.InfoDiv.title = divTitle;
  }
  else {
    AutoTPFleet.InfoDiv.title = text;
  }
}

AutoTPFleet.GetLocInfo = function (loc) {
  let threat = AutoTPFleet.GetRegionThreat(loc);
  if (threat.piracy === -1) {
    return `Inactive`;
  }
  return `S: ${threat.piracy}/${threat.max}, P: ${threat.patrol}.${AutoTPFleet.LocationStatus[loc] ? ` ${AutoTPFleet.LocationStatus[loc]}` : ``}`;
}

AutoTPFleet.Setup = function () {
  if (typeof $ != 'undefined') {
    let mainDiv = document.getElementById("main");
    if (mainDiv) {
      console.log("AutoTPFleet ready.");
      clearInterval(AutoTPFleet.ReadyCheck);
      AutoTPFleet.MainLoop();
    }
  }
}

window.addEventListener("load", function(event) {
  AutoTPFleet.ReadyCheck = setInterval(AutoTPFleet.Setup, 1000);
});
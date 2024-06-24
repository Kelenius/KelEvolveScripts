// ==UserScript==
// @name        Evolve prestige reward helper
// @namespace   Violentmonkey Scripts
// @match       https://pmotschmann.github.io/Evolve/*
// @version     1.1
// @author      Kelenius
// @license     MIT; https://spdx.org/licenses/MIT.html
// @description 25/05/2024, 14:48:01
// ==/UserScript==

/*
 * 1.0: Initial release.
 * 1.1: Better instruction, high pop bug fix, occupation fix
 */

// TO RETRIEVE REWARD FROM VOLCH'S AUTOMATION SCRIPT:
// 1) Install Volch's automation script and this script
// 2) Settings -> Logging Settings -> toggle "Prestige" on
// 3) Add {eval: PrestigeRewardHelper.Log(settings.prestigeType)} to the Prestige Log Format somewhere, it'll be replaced by the reward in the log
// 4) Only triggered by script prestige, won't work if you prestige manually
// You can also type PrestigeRewardHelper.Log("mad") (or any other prestige type) into the console to look at what you'd get right now

PrestigeRewardHelper = {}

PrestigeRewardHelper.Log = function (type) {
  let prestType = ""
  switch (type) {
    case "mad":
    case "bioseed":
    case "cataclysm":
    case "terraform":
    case "matrix":
    case "vacuum":
    case "eden":
      prestType = type;
      break;
    case "whitehole":
      prestType = "bigbang";
      break;
    case "apocalypse":
      prestType = "ai";
      break;
    case "ascension":
      prestType = "ascend";
      break;
    case "demonic":
      prestType = "descend";
      break;
    case "retire":
      prestType = "retired";
      break;
    default:
      return "Unknown presige type";
  }
  let reward = PrestigeRewardHelper.GetPrestigeReward(prestType);
  let ret = [];
  if (reward.plasmid > 0) {
    let plasmidType = evolve.global.race.universe == "antimatter" ? "Anti-Plasmids" : "Plasmids";
    ret.push(`${reward.plasmid} ${plasmidType}`);
  }
  if (reward.phage > 0) {
    ret.push(`${reward.phage} Phage`)
  }
  if (reward.dark > 0) {
    ret.push(`${reward.dark} Dark Energy`)
  }
  if (reward.harmony > 0) {
    ret.push(`${reward.harmony} Harmony Crystals`)
  }
  if (reward.artifact > 0) {
    ret.push(`${reward.artifact} Artifacts`)
  }
  if (reward.cores > 0) {
    ret.push(`${reward.cores} AI Cores`)
  }
  return ret.join("; ");
}

PrestigeRewardHelper.GetPrestigeReward = function (type) {
  let inputs = {};

  inputs.cit = evolve.global.resource[evolve.global.race.species].amount;
  inputs.sol = evolve.global.civic['garrison'] ? evolve.global.civic.garrison.workers : 0;
  let soldPerOcc = (evolve.global.civic.govern.type === 'federation' ? 15 : 20);
  if (evolve.global.race['high_pop']) {
    soldPerOcc *= evolve.traits.high_pop.vars(evolve.global.race['high_pop'])[0]
  }
  for (let i = 0; i < 3; ++i) {
    if (evolve.global.civic.foreign[`gov${i}`].occ){
      inputs.sol += soldPerOcc;
    }
  }
  inputs.know = evolve.global.stats.know;
  inputs.mass = evolve.global.interstellar['stellar_engine'] ? evolve.global.interstellar.stellar_engine.mass : 8;
  inputs.exotic = evolve.global.interstellar['stellar_engine'] ? evolve.global.interstellar.stellar_engine.exotic : 0;
  inputs.mana = evolve.global.resource.Mana.gen;
  inputs.floor = evolve.global.portal['spire'] ? evolve.global.portal.spire.count - 1 : 0;
  inputs.genes = evolve.alevel() - 1;
  inputs.uni = evolve.global.race.universe;
  //inputs.synth = evolve.races[evolve.global.race.species].type === 'synthetic';
  inputs.synth = false; // game bug
  inputs.high_pop = evolve.global.race['high_pop'] ? evolve.global.race['high_pop'] : false;
  inputs.tp = (evolve.global.race['truepath'] ? true : false);

  inputs.extraPlasmids = 0;
  if (evolve.global.race['cataclysm']) inputs.extraPlasmids += 300;
  if (evolve.global.race['lone_survivor']) inputs.extraPlasmids += 800;

  let gains = PrestigeRewardHelper.calcPrestige(type, inputs);

  if (type == "descend") gains.plasmid = 0;

  return gains;
}

// Here and below is code taken from https://github.com/pmotschmann/Evolve, under Mozilla Public License Version 2.0

PrestigeRewardHelper.calcPrestige = function (type, inputs) {
    let gains = {
        plasmid: 0,
        phage: 0,
        dark: 0,
        harmony: 0,
        artifact: 0,
        cores: 0,
    };

    //if (!inputs) { inputs = {}; }
    //if (inputs.synth !== undefined) inputs.synth = races[global.race.species].type === 'synthetic';
    let challenge = inputs.genes;
    let universe = inputs.uni;
    // universe = universe || global.race.universe;

    let pop = 0;
    // if (inputs.cit === undefined){
    //     let garrisoned = global.civic.hasOwnProperty('garrison') ? global.civic.garrison.workers : 0;
    //     for (let i=0; i<3; i++){
    //         if (global.civic.foreign[`gov${i}`].occ){
    //             garrisoned += jobScale(global.civic.govern.type === 'federation' ? 15 : 20);
    //         }
    //     }
    //     if (global.race['high_pop']){
    //         pop = Math.round(global.resource[global.race.species].amount / traits.high_pop.vars()[0]) + Math.round(garrisoned / traits.high_pop.vars()[0]);
    //     }
    //     else {
    //         pop = global.resource[global.race.species].amount + garrisoned;
    //     }
    // }
    // else {
        if (inputs.high_pop){
            pop = Math.round(inputs.cit / evolve.traits.high_pop.vars(inputs.high_pop)[0]) + Math.round(inputs.sol / evolve.traits.high_pop.vars(inputs.high_pop)[0]);
        }
        else {
            pop = inputs.cit + inputs.sol;
        }
    // }

    let rc = PrestigeRewardHelper.getResetConstants(type, inputs);
    let pop_divisor = rc.pop_divisor;
    let k_inc = rc.k_inc;
    let k_mult = rc.k_mult;
    let phage_mult = rc.phage_mult;
    let plasmid_cap = rc.plasmid_cap;


    if (challenge !== undefined){
        plasmid_cap = Math.floor(plasmid_cap * (1 + (challenge + (inputs.tp ? 1 : 0)) / 8));
    }
    // else {
    //     plasmid_cap = Math.floor(plasmid_cap * (1 + (alevel() - (global.race['truepath'] ? 0 : 1)) / 8));
    // }

    if (inputs.plas === undefined){
        let k_base = inputs.know !== undefined ? inputs.know : global.stats.know;
        let new_plasmid = Math.round(pop / pop_divisor);
        while (k_base > k_inc){
            new_plasmid++;
            k_base -= k_inc;
            k_inc *= k_mult;
        }

        new_plasmid += inputs.extraPlasmids; /* Added */
        // if (global.race['cataclysm']){
        //     new_plasmid += 300;
        // }
        // else if (global.race['lone_survivor']){
        //     new_plasmid += 800;
        // }

        gains.plasmid = PrestigeRewardHelper.challenge_multiplier(new_plasmid,type,false,inputs);

        if (!inputs.rawPlasmids && gains.plasmid > plasmid_cap){
            let overflow = gains.plasmid - plasmid_cap;
            gains.plasmid = plasmid_cap;
            overflow = Math.floor(overflow / (overflow + plasmid_cap) * plasmid_cap);
            gains.plasmid += overflow;
        }
    }
    else {
        gains.plasmid = inputs.plas;
    }
    gains.phage = gains.plasmid > 0 ? PrestigeRewardHelper.challenge_multiplier(Math.floor(Math.log2(gains.plasmid) * Math.E * phage_mult),type,false,inputs) : 0;

    if (type === 'bigbang'){
        let exotic = inputs.exotic;
        let mass = inputs.mass;
        // if (exotic === undefined && global['interstellar'] && global.interstellar['stellar_engine']){
        //     exotic = global.interstellar.stellar_engine.exotic;
        //     mass = global.interstellar.stellar_engine.mass;
        // }

        let new_dark = +(Math.log(1 + (exotic * 40))).toFixed(3);
        new_dark += +(Math.log2(mass - 7)/2.5).toFixed(3);
        new_dark = PrestigeRewardHelper.challenge_multiplier(new_dark,'bigbang',3,inputs);
        gains.dark = new_dark;
    }
    else if (type === 'vacuum'){
        let mana = inputs.mana !== undefined ? inputs.mana : global.resource.Mana.gen;
        let new_dark = +(Math.log2(mana)/5).toFixed(3);
        new_dark = PrestigeRewardHelper.challenge_multiplier(new_dark,'vacuum',3,inputs);
        gains.dark = new_dark;
    }


    if (['ascend','descend','terraform'].includes(type)){
        let harmony = 1;
        // if (challenge === undefined){
        //     harmony = alevel();
        //     if (harmony > 5){
        //         harmony = 5;
        //     }
        // }
        // else {
            harmony = challenge + 1;
        // }

        if (type === 'ascend' || type === 'terraform'){
            switch (universe){
                case 'micro':
                    harmony *= 0.25;
                    break;
                case 'heavy':
                    harmony *= 1.2;
                    break;
                case 'antimatter':
                    harmony *= 1.1;
                    break;
                default:
                    break;
            }
            gains.harmony = parseFloat(harmony.toFixed(2));
        }
        else if (type === 'descend'){
            let artifact = universe === 'micro' ? 1 : harmony;
            let spire = inputs.floor;
            if (spire !== undefined){
                spire++;
            }
            // else {
            //     spire = global.portal.hasOwnProperty('spire') ? global.portal.spire.count : 0;
            // }
            [50,100].forEach(function(x){
                if (spire > x){
                    artifact++;
                }
            });
            gains.artifact = artifact;
        }
    }

    if (type === 'ai'){
        gains.cores = universe === 'micro' ? 2 : 5;
    }

    return gains;
}

PrestigeRewardHelper.getResetConstants = function (type, inputs) {
    if (!inputs) { inputs = {}; }
    let rc = {
        pop_divisor: 999,
        k_inc: 1000000,
        k_mult: 100,
        phage_mult: 0,
        plasmid_cap: 150,
    }

    switch (type){
        case 'mad':
            rc.pop_divisor = 3;
            rc.k_inc = 100000;
            rc.k_mult = 1.1;
            rc.plasmid_cap = 150;
            if (inputs.synth){
                rc.pop_divisor = 5;
                rc.k_inc = 125000;
                rc.plasmid_cap = 100;
            }
            break;
        case 'cataclysm':
        case 'bioseed':
            rc.pop_divisor = 3;
            rc.k_inc = 50000;
            rc.k_mult = 1.015;
            rc.phage_mult = 1;
            rc.plasmid_cap = 400;
            break;
        case 'ai':
            rc.pop_divisor = 2.5;
            rc.k_inc = 45000;
            rc.k_mult = 1.014;
            rc.phage_mult = 2;
            rc.plasmid_cap = 600;
            break;
        case 'vacuum':
        case 'bigbang':
            rc.pop_divisor = 2.2;
            rc.k_inc = 40000;
            rc.k_mult = 1.012;
            rc.phage_mult = 2.5;
            rc.plasmid_cap = 800;
            break;
        case 'ascend':
        case 'terraform':
            rc.pop_divisor = 1.15;
            rc.k_inc = 30000;
            rc.k_mult = 1.008;
            rc.phage_mult = 4;
            rc.plasmid_cap = 2000;
            break;
        case 'matrix':
            rc.pop_divisor = 1.5;
            rc.k_inc = 32000;
            rc.k_mult = 1.01;
            rc.phage_mult = 3.2;
            rc.plasmid_cap = 1800;
            break;
        case 'retired':
            rc.pop_divisor = 1.15;
            rc.k_inc = 32000;
            rc.k_mult = 1.006;
            rc.phage_mult = 3.2;
            rc.plasmid_cap = 1800;
            break;
        case 'eden':
            rc.pop_divisor = 1;
            rc.k_inc = 18000;
            rc.k_mult = 1.004;
            rc.phage_mult = 2.5;
            rc.plasmid_cap = 1800;
            break;
        default:
            rc.unknown = true;
            break;
    }
    return rc;
}

PrestigeRewardHelper.challenge_multiplier = function(value,type,decimals,inputs){
    decimals = decimals || 0;
    inputs = inputs || {};

    let challenge_level = inputs.genes;
    if (challenge_level === undefined){
        challenge_level = alevel() - 1;
        if (challenge_level > 4){
            challenge_level = 4;
        }
    }
    let universe = inputs.uni || global.race.universe;

    if (universe === 'micro'){ value = value * 0.25; }
    if (universe === 'antimatter'){ value = value * 1.1; }
    if (universe === 'heavy' && type !== 'mad'){
        switch (challenge_level){
            case 1:
                value = value * 1.1;
                break;
            case 2:
                value = value * 1.15;
                break;
            case 3:
                value = value * 1.2;
                break;
            case 4:
                value = value * 1.25;
                break;
            default:
                value = value * 1.05;
                break;
        }
    }
    if (inputs.tp !== undefined ? inputs.tp : global.race['truepath']){
        value = value * 1.1;
    }
    switch (challenge_level){
        case 1:
            return +(value * 1.05).toFixed(decimals);
        case 2:
            return +(value * 1.12).toFixed(decimals);
        case 3:
            return +(value * 1.25).toFixed(decimals);
        case 4:
            return +(value * 1.45).toFixed(decimals);
        default:
            return +(value).toFixed(decimals);
    }
}
import { Monster, Trait } from "../../index";
import { ONE_ACTION, addSign, getACStats, getModifierToDiceRoll, toTitleCase } from "./pf2eMonsterToolImport";

export interface FoundryPf2eActor {
    _id: string;
    name: string;
    type: "npc";
    img?: string;
    items?: FoundryPf2eItem[];
    system: FoundryPf2eSystem;
}

export interface FoundryPf2eItem {
    _id: string;
    name: string;
    type: string;
    system: any;
}

export interface FoundryPf2eSystem {
    abilities: {
        str: { mod: number; value: number };
        dex: { mod: number; value: number };
        con: { mod: number; value: number };
        int: { mod: number; value: number };
        wis: { mod: number; value: number };
        cha: { mod: number; value: number };
    };
    attributes: {
        ac: {
            value: number;
            details?: string;
        };
        hp: {
            value: number;
            max: number;
            details?: string;
        };
        speed: {
            value: number;
            otherSpeeds?: Array<{
                type: string;
                value: number;
            }>;
        };
        resistances?: Array<{
            type: string;
            value: number;
            exceptions?: string[];
        }>;
        weaknesses?: Array<{
            type: string;
            value: number;
            exceptions?: string[];
        }>;
        immunities?: Array<{
            type: string;
            exceptions?: string[];
        }>;
        allSaves?: {
            value?: string;
        };
    };
    details: {
        level: {
            value: number;
        };
        languages?: {
            value: string[];
            details?: string;
        };
        publicNotes?: string;
        blurb?: string;
        publication?: {
            title?: string;
            license?: string;
        };
    };
    traits: {
        value: string[];
        size: {
            value: string;
        };
        rarity?: string;
    };
    saves: {
        fortitude: {
            value: number;
            saveDetail?: string;
        };
        reflex: {
            value: number;
            saveDetail?: string;
        };
        will: {
            value: number;
            saveDetail?: string;
        };
    };
    perception?: {
        mod: number;
        details?: string;
        senses?: Array<{
            type: string;
            range?: number;
            acuity?: string;
        }>;
    };
    skills?: Record<string, {
        base: number;
        note?: string;
    }>;
}

export async function buildMonsterFromFoundryPf2eFile(
    file: File
): Promise<Monster[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event: any) => {
            try {
                let json = JSON.parse(event.target.result);
                const monsters: Monster[] = [];

                // The Foundry format can be a single actor or an array
                if (Array.isArray(json)) {
                    for (const actorData of json) {
                        try {
                            if (actorData.type === "npc") {
                                monsters.push(convertFoundryPf2eActorToMonster(actorData));
                            }
                        } catch (error) {
                            console.error(`Error converting creature ${actorData.name || 'unknown'}:`, error);
                            // Skip this monster and continue with the next one
                        }
                    }
                } else if (json.type === "npc") {
                    // Single actor
                    try {
                        monsters.push(convertFoundryPf2eActorToMonster(json));
                    } catch (error) {
                        console.error(`Error converting creature ${json.name || 'unknown'}:`, error);
                    }
                }

                resolve(monsters);
            } catch (e) {
                console.error(`Error parsing Foundry Pf2e file:`, e);
                reject(e);
            }
        };
        reader.readAsText(file);
    });
}

export function convertFoundryPf2eActorToMonster(actor: FoundryPf2eActor): Monster {
    const system = actor.system;
    
    // Extract ability modifiers as array
    const stats: [number, number, number, number, number, number] = [
        system.abilities.str.mod,
        system.abilities.dex.mod,
        system.abilities.con.mod,
        system.abilities.int.mod,
        system.abilities.wis.mod,
        system.abilities.cha.mod
    ];
    
    const ac = system.attributes.ac.value;
    const fortitude = system.saves.fortitude.value;
    const reflex = system.saves.reflex.value;
    const will = system.saves.will.value;
    
    const hp = system.attributes.hp.max;
    const level = system.details.level.value;
    
    // Create speed string
    const speedEntries: string[] = [];
    speedEntries.push(`${system.attributes.speed.value} feet`);
    
    if (system.attributes.speed.otherSpeeds) {
        for (const speed of system.attributes.speed.otherSpeeds) {
            speedEntries.push(`${speed.type} ${speed.value} feet`);
        }
    }
    
    const speedString = speedEntries.join(", ");
    
    // Process traits - convert size and traits from foundry format
    const traits = [...system.traits.value];
    const size = mapFoundrySize(system.traits.size.value);
    
    // Process abilities/actions from items
    const abilities_top: Trait[] = [];
    const abilities_mid: Trait[] = [];
    const abilities_bot: Trait[] = [];
    const attacks: Trait[] = [];
    const spellcasting: Trait[] = [];
    
    if (actor.items) {
        for (const item of actor.items) {
            if (item.type === "action") {
                // Process actions
                const ability = processFoundryAction(item);
                if (ability) {
                    // Categorize abilities (foundry doesn't have clear categories, so we'll make assumptions)
                    if (item.system?.actionType?.value === "reaction") {
                        abilities_mid.push(ability);
                    } else if (item.system?.actionType?.value === "passive") {
                        abilities_bot.push(ability);
                    } else {
                        abilities_top.push(ability);
                    }
                }
            } else if (item.type === "weapon" || item.type === "melee") {
                // Process attacks
                const attack = processFoundryWeapon(item);
                if (attack) {
                    attacks.push(attack);
                }
            } else if (item.type === "spellcastingEntry") {
                // Process spellcasting
                const spell = processFoundrySpellcasting(item);
                if (spell) {
                    spellcasting.push(spell);
                }
            }
        }
    }
    
    // Process senses
    const sensesArray: string[] = [];
    if (system.perception?.senses) {
        for (const sense of system.perception.senses) {
            let senseString = sense.type;
            if (sense.range) {
                senseString += ` ${sense.range} feet`;
            }
            if (sense.acuity && sense.acuity !== "precise") {
                senseString += ` (${sense.acuity})`;
            }
            sensesArray.push(senseString);
        }
    }
    const senses = sensesArray.join(", ");
    
    // Process languages
    const languages = system.details.languages?.value?.join(", ") || "";
    const languageDetails = system.details.languages?.details || "";
    
    // Process skills
    const skills = processFoundrySkills(system.skills || {});
    
    // Process resistances, immunities, weaknesses
    const resistances = (system.attributes.resistances || [])
        .map(r => `${r.type} ${r.value}${r.exceptions?.length ? ` (except ${r.exceptions.join(", ")})` : ""}`)
        .join(", ");
    
    const weaknesses = (system.attributes.weaknesses || [])
        .map(w => `${w.type} ${w.value}${w.exceptions?.length ? ` (except ${w.exceptions.join(", ")})` : ""}`)
        .join(", ");
    
    const immunities = (system.attributes.immunities || [])
        .map(i => `${i.type}${i.exceptions?.length ? ` (except ${i.exceptions.join(", ")})` : ""}`)
        .join(", ");
    
    // Extract type from traits
    const creatureType = getCreatureTypeFromTraits(traits);
    const alignment = getAlignmentFromTraits(traits);
    
    // Create the monster object
    const monster: Monster = {
        layout: "Basic Pathfinder 2e Layout",
        name: actor.name,
        level: `Creature ${level}`,
        size: size,
        trait_03: creatureType,
        modifier: system.perception?.mod || 0,
        perception: [{
            name: "Perception",
            desc: `Perception ${addSign(system.perception?.mod || 0)}${senses ? `; ${senses}` : ""}${system.perception?.details ? `; ${system.perception.details}` : ""}`
        }],
        abilities_top,
        abilities_mid,
        abilities_bot,
        type: creatureType,
        subtype: "",
        alignment: alignment,
        ac,
        armorclass: getACStats(ac, fortitude, reflex, will),
        hp,
        health: [{
            name: "HP",
            desc: `${hp}${system.attributes.hp.details ? ` (${system.attributes.hp.details})` : ""}${immunities ? `; __Immunities__ ${immunities}` : ""}${resistances ? `; __Resistances__ ${resistances}` : ""}${weaknesses ? `; __Weaknesses__ ${weaknesses}` : ""}`
        }],
        attacks,
        spellcasting,
        speed: speedString,
        stats,
        abilityMods: stats,
        damage_vulnerabilities: weaknesses,
        damage_resistances: resistances,
        damage_immunities: immunities,
        condition_immunities: "",
        senses,
        languages: languages + (languageDetails ? `; ${languageDetails}` : ""),
        cr: level,
        bestiary: false,
        skills,
        source: system.details.publication?.title || "Unknown"
    };
    
    // Add remaining traits as trait_04, trait_05, etc.
    for (let i = 0; i < traits.length; i++) {
        const traitIndexStr = (i + 4).toString().padStart(2, '0');
        const traitKeyString = `trait_${traitIndexStr}`;
        monster[traitKeyString] = toTitleCase(traits[i]);
    }
    
    return monster;
}

function mapFoundrySize(foundrySize: string): string {
    const sizeMap: Record<string, string> = {
        "tiny": "Tiny",
        "sm": "Small", 
        "med": "Medium",
        "lg": "Large",
        "huge": "Huge",
        "grg": "Gargantuan"
    };
    
    return sizeMap[foundrySize] || "Medium";
}

function processFoundryAction(item: FoundryPf2eItem): Trait | null {
    if (!item.system) return null;
    
    const name = item.name;
    let description = item.system.description?.value || "";
    
    // Clean up HTML tags
    description = description.replace(/<[^>]*>/g, "").trim();
    
    // Add action cost if available
    let actionCost = "";
    if (item.system.actionType?.value === "action") {
        const actions = item.system.actions?.value || 1;
        if (actions === 1) actionCost = ONE_ACTION;
        else if (actions === 2) actionCost = "⬺ ";
        else if (actions === 3) actionCost = "⬽ ";
    } else if (item.system.actionType?.value === "reaction") {
        actionCost = "⬲ ";
    } else if (item.system.actionType?.value === "free") {
        actionCost = "⭓ ";
    }
    
    return {
        name,
        desc: actionCost + description
    };
}

function processFoundryWeapon(item: FoundryPf2eItem): Trait | null {
    if (!item.system) return null;
    
    const name = item.name;
    const attackBonus = item.system.attack?.value || 0;
    const damageRolls = item.system.damageRolls || {};
    const traits = item.system.traits?.value || [];
    
    let desc = ONE_ACTION + ` ${name} ${addSign(attackBonus)}`;
    
    if (traits.length > 0) {
        desc += ` (${traits.join(", ")})`;
    }
    
    // Add damage if available
    if (Object.keys(damageRolls).length > 0) {
        const damages = Object.values(damageRolls).map((roll: any) => {
            if (roll.damage) {
                return `${roll.damage} ${roll.damageType || ""}`.trim();
            }
            return "";
        }).filter(d => d);
        
        if (damages.length > 0) {
            desc += ` __Damage__ ${damages.join(" plus ")}`;
        }
    }
    
    return {
        name: item.system.weaponType?.value === "ranged" ? "Ranged" : "Melee",
        desc
    };
}

function processFoundrySpellcasting(item: FoundryPf2eItem): Trait | null {
    if (!item.system) return null;
    
    const name = item.name;
    let description = "";
    
    if (item.system.tradition?.value) {
        description += `${toTitleCase(item.system.tradition.value)} `;
    }
    
    if (item.system.spelldc?.value) {
        description += `DC ${item.system.spelldc.value}; `;
    }
    
    // Add spell slots/focus points info if available
    if (item.system.slots) {
        for (const [level, slotData] of Object.entries(item.system.slots)) {
            if (slotData && typeof slotData === 'object' && 'max' in slotData) {
                const slots = (slotData as any).max;
                if (slots > 0) {
                    if (level === "0") {
                        description += `__Cantrips__ `;
                    } else {
                        description += `__Level ${level}__ (${slots} slots) `;
                    }
                }
            }
        }
    }
    
    return {
        name,
        desc: description.trim()
    };
}

function processFoundrySkills(skills: Record<string, { base: number; note?: string }>): Trait[] {
    const skillEntries = Object.entries(skills).map(([name, data]) => {
        const skillName = toTitleCase(name);
        const value = data.base;
        const note = data.note ? ` (${data.note})` : "";
        
        return `__${skillName}__: ${getModifierToDiceRoll(value)}${note}`;
    });
    
    if (skillEntries.length === 0) {
        return [];
    }
    
    return [{
        name: "Skills",
        desc: skillEntries.join(" ")
    }];
}

function getCreatureTypeFromTraits(traits: string[]): string {
    const typeOrder = [
        "aberration", "animal", "astral", "beast", "celestial", "construct", 
        "dragon", "elemental", "fey", "fiend", "giant", "humanoid", 
        "monitor", "ooze", "plant", "spirit", "undead"
    ];
    
    for (const type of typeOrder) {
        if (traits.some(t => t.toLowerCase() === type)) {
            return toTitleCase(type);
        }
    }
    
    return "Humanoid"; // Default
}

function getAlignmentFromTraits(traits: string[]): string {
    const alignmentMap: Record<string, string> = {
        "lg": "Lawful Good",
        "ng": "Neutral Good", 
        "cg": "Chaotic Good",
        "ln": "Lawful Neutral",
        "n": "Neutral",
        "cn": "Chaotic Neutral",
        "le": "Lawful Evil",
        "ne": "Neutral Evil",
        "ce": "Chaotic Evil"
    };
    
    for (const trait of traits) {
        const alignment = alignmentMap[trait.toLowerCase()];
        if (alignment) return alignment;
    }
    
    return "Neutral"; // Default
}
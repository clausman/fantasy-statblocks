import { Monster, Trait } from "../../index";
import { ONE_ACTION, addSign, getACStats, getModifierToDiceRoll, toTitleCase } from "./pf2eMonsterToolImport";

export interface FoundryPf2eCreature {
    _id?: string;
    name: string;
    type?: string;
    system: {
        details: {
            level: {
                value: number;
            };
            creatureType?: string;
            source?: {
                value: string;
            };
            alignment?: {
                value: string;
            };
        };
        attributes: {
            ac: {
                value: number;
            };
            hp: {
                value: number;
                max?: number;
            };
            perception: {
                value: number;
            };
            speed?: {
                value: string;
                otherSpeeds?: Array<{
                    type: string;
                    value: number;
                }>;
            };
        };
        abilities: {
            str: { mod: number };
            dex: { mod: number };
            con: { mod: number };
            int: { mod: number };
            wis: { mod: number };
            cha: { mod: number };
        };
        saves: {
            fortitude: { value: number };
            reflex: { value: number };
            will: { value: number };
        };
        skills?: Record<string, {
            value: number;
            note?: string;
        }>;
        traits?: {
            value: string[];
        };
        immunities?: Array<{
            type: string;
        }>;
        resistances?: Array<{
            type: string;
            value: number;
        }>;
        weaknesses?: Array<{
            type: string;
            value: number;
        }>;
    };
    items?: Array<{
        name: string;
        type: string;
        system?: any;
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

                // Handle different possible formats
                let creatures: FoundryPf2eCreature[] = [];
                
                if (Array.isArray(json)) {
                    // Direct array of creatures
                    creatures = json;
                } else if (json.system && json.name) {
                    // Single creature object
                    creatures = [json];
                } else if (json.creatures && Array.isArray(json.creatures)) {
                    // Wrapped in creatures array
                    creatures = json.creatures;
                } else {
                    // Try to find arrays of creatures in the object
                    for (const key in json) {
                        if (Array.isArray(json[key])) {
                            creatures = json[key];
                            break;
                        }
                    }
                }

                for (const creatureData of creatures) {
                    try {
                        // Only process if it looks like a creature
                        if (creatureData.system && creatureData.name) {
                            monsters.push(convertFoundryPf2eCreatureToMonster(creatureData));
                        }
                    } catch (error) {
                        console.error(`Error converting creature ${creatureData.name || 'unknown'}:`, error);
                        // Skip this monster and continue with the next one
                    }
                }

                resolve(monsters);
            } catch (e) {
                console.error(`Error parsing FoundryVTT PF2e file:`, e);
                reject(e);
            }
        };
        reader.readAsText(file);
    });
}

export function convertFoundryPf2eCreatureToMonster(creature: FoundryPf2eCreature): Monster {
    const stats: [number, number, number, number, number, number] = [
        creature.system.abilities.str.mod,
        creature.system.abilities.dex.mod,
        creature.system.abilities.con.mod,
        creature.system.abilities.int.mod,
        creature.system.abilities.wis.mod,
        creature.system.abilities.cha.mod
    ];
    
    const ac = creature.system.attributes.ac.value;
    const fortitude = creature.system.saves.fortitude.value;
    const reflex = creature.system.saves.reflex.value;
    const will = creature.system.saves.will.value;
    
    // Extract the HP value
    const hp = creature.system.attributes.hp.value;
    
    // Process speed
    const speedString = creature.system.attributes.speed?.value || "25 feet";
    
    // Process traits
    const traits = creature.system.traits?.value || [];
    
    // Process skills
    const skills = processFoundrySkills(creature.system.skills || {});
    
    // Process immunities, resistances, and weaknesses
    const immunities = (creature.system.immunities || [])
        .map(i => i.type)
        .join(", ");
    
    const resistances = (creature.system.resistances || [])
        .map(r => `${r.type} ${r.value}`)
        .join(", ");
    
    const weaknesses = (creature.system.weaknesses || [])
        .map(w => `${w.type} ${w.value}`)
        .join(", ");
    
    // Process abilities/actions from items
    const abilities_top: Trait[] = [];
    const abilities_mid: Trait[] = [];
    const abilities_bot: Trait[] = [];
    const attacks: Trait[] = [];
    const spellcasting: Trait[] = [];
    
    if (creature.items) {
        for (const item of creature.items) {
            if (item.type === "action") {
                const trait: Trait = {
                    name: item.name,
                    desc: item.system?.description?.value || ""
                };
                
                // Categorize based on action type or other criteria
                if (item.system?.actionType?.value === "passive") {
                    abilities_top.push(trait);
                } else if (item.system?.actionType?.value === "defensive") {
                    abilities_mid.push(trait);
                } else {
                    abilities_bot.push(trait);
                }
            } else if (item.type === "melee" || item.type === "ranged") {
                const attackBonus = item.system?.bonus?.value || 0;
                const damage = item.system?.damage?.value || "";
                const traits = item.system?.traits?.value?.join(", ") || "";
                
                attacks.push({
                    name: item.type === "melee" ? "Melee" : "Ranged",
                    desc: `${ONE_ACTION} ${item.name} ${addSign(attackBonus)}${traits ? ` (${traits})` : ""}${damage ? ` __Damage__ ${damage}` : ""}`
                });
            } else if (item.type === "spellcastingEntry") {
                spellcasting.push({
                    name: item.name,
                    desc: item.system?.description?.value || ""
                });
            }
        }
    }
    
    // Create the monster object
    const monster: Monster = {
        layout: "Basic Pathfinder 2e Layout",
        name: creature.name,
        level: `Creature ${creature.system.details.level.value}`,
        size: getSizeFromTraits(traits),
        trait_03: creature.system.details.creatureType || getTypeFromTraits(traits),
        modifier: creature.system.attributes.perception.value,
        perception: [{
            name: "Perception",
            desc: `Perception ${addSign(creature.system.attributes.perception.value)};`
        }],
        abilities_top,
        abilities_mid,
        abilities_bot,
        type: creature.system.details.creatureType || getTypeFromTraits(traits),
        subtype: "",
        alignment: parseAlignment(creature.system.details.alignment?.value || ""),
        ac,
        armorclass: getACStats(ac, fortitude, reflex, will),
        hp,
        health: [{
            name: "HP",
            desc: `${hp}${immunities ? `; __Immunities__ ${immunities}` : ""}${resistances ? `; __Resistances__ ${resistances}` : ""}${weaknesses ? `; __Weaknesses__ ${weaknesses}` : ""}`
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
        senses: "",
        languages: "",
        cr: creature.system.details.level.value,
        bestiary: false,
        skills,
        source: creature.system.details.source?.value || "FoundryVTT PF2e"
    };
    
    // Add traits
    for (let i = 0; i < traits.length; i++) {
        const traitIndexStr = (i + 4).toString().padStart(2, '0');
        const traitKeyString = `trait_${traitIndexStr}`;
        monster[traitKeyString] = traits[i];
    }
    
    return monster;
}

function processFoundrySkills(skills: Record<string, { value: number; note?: string }>): Trait[] {
    const skillEntries = Object.entries(skills).map(([name, data]) => {
        const skillName = toTitleCase(name);
        const value = data.value;
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

function getSizeFromTraits(traits: string[]): string {
    const sizeMap: Record<string, string> = {
        "tiny": "Tiny",
        "small": "Small",
        "medium": "Medium",
        "large": "Large",
        "huge": "Huge",
        "gargantuan": "Gargantuan"
    };
    
    for (const trait of traits) {
        const size = sizeMap[trait.toLowerCase()];
        if (size) return size;
    }
    
    return "Medium"; // Default
}

function getTypeFromTraits(traits: string[]): string {
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

function parseAlignment(alignment: string): string {
    const alignmentMap: Record<string, string> = {
        "LG": "Lawful Good",
        "NG": "Neutral Good", 
        "CG": "Chaotic Good",
        "LN": "Lawful Neutral",
        "N": "Neutral",
        "CN": "Chaotic Neutral",
        "LE": "Lawful Evil",
        "NE": "Neutral Evil",
        "CE": "Chaotic Evil"
    };
    
    return alignmentMap[alignment.toUpperCase()] || "Neutral";
}
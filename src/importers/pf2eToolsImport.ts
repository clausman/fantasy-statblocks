import { Monster, Trait } from "index";
import { ONE_ACTION, addSign, getACStats, getModifierToDiceRoll, toTitleCase } from "./pf2eMonsterToolImport";

export interface Pf2eToolsCreature {
    name: string;
    source: string;
    page?: number;
    level: number;
    traits: string[];
    perception: {
        std: number;
    };
    senses?: {
        name: string;
    }[];
    languages?: {
        languages?: string[];
        abilities?: string[];
    };
    skills?: Record<string, {
        std: number;
        note?: string;
    }>;
    abilityMods: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    };
    items?: string[];
    speed: {
        walk?: number;
        fly?: number;
        swim?: number;
        climb?: number;
        burrow?: number;
    };
    attacks?: {
        range: "Melee" | "Ranged";
        name: string;
        attack: number;
        traits?: string[];
        damage?: string;
        types?: string[];
    }[];
    spellcasting?: {
        type: string;
        tradition?: string;
        DC?: number;
        fp?: number;
        name?: string;
        entry: Record<string, {
            level?: number;
            spells: {
                name: string;
            }[];
        }>;
    }[];
    abilities?: {
        top?: Ability[];
        mid?: Ability[];
        bot?: Ability[];
    };
    defenses: {
        ac: {
            std: number;
            [key: string]: number;
        };
        savingThrows: {
            fort: {
                std: number;
            };
            ref: {
                std: number;
            };
            will: {
                std: number;
            };
        };
        hp: {
            hp: number;
            note?: string;
        }[];
        immunities?: string[];
        resistances?: {
            amount: number;
            name: string;
            note?: string;
        }[];
        weaknesses?: {
            amount: number;
            name: string;
            note?: string;
        }[];
    };
}

interface Ability {
    name: string;
    entries?: (string | { type: string; items: string[] })[];
    activity?: {
        number: number;
        unit: string;
    };
    trigger?: string;
}

export async function buildMonsterFromPf2eToolsFile(
    file: File
): Promise<Monster[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event: any) => {
            try {
                let json = JSON.parse(event.target.result);
                const monsters: Monster[] = [];

                // The Pf2eTools format has creatures in a "creature" array
                if (json.creature && Array.isArray(json.creature)) {
                    for (const creatureData of json.creature) {
                        monsters.push(convertPf2eToolsCreatureToMonster(creatureData));
                    }
                }

                resolve(monsters);
            } catch (e) {
                console.error(`Error parsing Pf2eTools file:`, e);
                reject(e);
            }
        };
        reader.readAsText(file);
    });
}

function convertPf2eToolsCreatureToMonster(creature: Pf2eToolsCreature): Monster {
    const stats: [number, number, number, number, number, number] = [
        creature.abilityMods.str,
        creature.abilityMods.dex,
        creature.abilityMods.con,
        creature.abilityMods.int,
        creature.abilityMods.wis,
        creature.abilityMods.cha
    ];
    
    const ac = creature.defenses.ac.std;
    const fortitude = creature.defenses.savingThrows.fort.std;
    const reflex = creature.defenses.savingThrows.ref.std;
    const will = creature.defenses.savingThrows.will.std;
    
    // Extract the HP value
    const hp = creature.defenses.hp[0].hp;
    const hpNote = creature.defenses.hp[0].note || "";
    
    // Create speed string
    const speedEntries: string[] = [];
    if (creature.speed.walk) speedEntries.push(`${creature.speed.walk} feet`);
    if (creature.speed.fly) speedEntries.push(`fly ${creature.speed.fly} feet`);
    if (creature.speed.swim) speedEntries.push(`swim ${creature.speed.swim} feet`);
    if (creature.speed.climb) speedEntries.push(`climb ${creature.speed.climb} feet`);
    if (creature.speed.burrow) speedEntries.push(`burrow ${creature.speed.burrow} feet`);
    
    const speedString = speedEntries.join(", ");
    
    // Process traits
    const traits = creature.traits || [];
    
    // Process abilities
    const abilities_top = processAbilities(creature.abilities?.top || []);
    const abilities_mid = processAbilities(creature.abilities?.mid || []);
    const abilities_bot = processAbilities(creature.abilities?.bot || []);
    
    // Process attacks
    const attacks = processAttacks(creature.attacks || []);
    
    // Process spellcasting
    const spellcasting = processSpellcasting(creature.spellcasting || []);
    
    // Process senses
    const sensesArray = creature.senses?.map(s => s.name) || [];
    const senses = sensesArray.join(", ");
    
    // Process languages
    let languagesList: string[] = [];
    if (creature.languages?.languages) {
        languagesList = languagesList.concat(creature.languages.languages);
    }
    if (creature.languages?.abilities) {
        languagesList = languagesList.concat(creature.languages.abilities);
    }
    const languages = languagesList.join(", ");
    
    // Process skills
    const skills = processSkills(creature.skills || {});
    
    // Process immunities, resistances, and weaknesses
    const immunities = (creature.defenses.immunities || []).join(", ");
    
    const resistances = (creature.defenses.resistances || [])
        .map(r => `${r.name} ${r.amount}${r.note ? ` (${r.note})` : ""}`)
        .join(", ");
    
    const weaknesses = (creature.defenses.weaknesses || [])
        .map(w => `${w.name} ${w.amount}${w.note ? ` (${w.note})` : ""}`)
        .join(", ");
    
    // Create the monster object
    const monster: Monster = {
        layout: "Basic Pathfinder 2e Layout",
        name: creature.name,
        level: `Creature ${creature.level}`,
        size: getSizeString(traits),
        trait_03: getTypeFromTraits(traits),
        modifier: creature.perception.std,
        perception: [{
            name: "Perception",
            desc: `Perception ${addSign(creature.perception.std)};${senses ? ` ${senses}` : ""}`
        }],
        abilities_top,
        abilities_mid,
        abilities_bot,
        type: getTypeFromTraits(traits),
        subtype: "",
        alignment: getAlignmentFromTraits(traits),
        ac,
        armorclass: getACStats(ac, fortitude, reflex, will),
        hp,
        health: [{
            name: "HP",
            desc: `${hp}${hpNote ? ` (${hpNote})` : ""}${immunities ? `; __Immunities__ ${immunities}` : ""}${resistances ? `; __Resistances__ ${resistances}` : ""}${weaknesses ? `; __Weaknesses__ ${weaknesses}` : ""}`
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
        languages,
        cr: creature.level,
        bestiary: false,
        skills,
        source: creature.source
    };
    
    // Add traits
    for (let i = 0; i < traits.length; i++) {
        const traitIndexStr = (i + 4).toString().padStart(2, '0');
        const traitKeyString = `trait_${traitIndexStr}`;
        monster[traitKeyString] = traits[i];
    }
    
    return monster;
}

function processAbilities(abilities: Ability[]): Trait[] {
    return abilities.map(ability => {
        const actionIcon = getActionIcon(ability);
        const description = processEntries(ability.entries || []);
        
        let desc = "";
        if (actionIcon) desc += actionIcon + " ";
        if (ability.trigger) desc += `__Trigger__ ${ability.trigger} `;
        desc += description;
        
        return {
            name: ability.name,
            desc
        };
    });
}

function processEntries(entries: (string | { type: string; items: string[] })[]): string {
    let result = "";
    
    for (const entry of entries) {
        if (typeof entry === "string") {
            // Replace Pf2eTools-specific formatting
            let processed = entry.replace(/{@condition ([^}]*)}/g, "__$1__")
                               .replace(/{@action ([^}]*)}/g, "__$1__")
                               .replace(/{@trait ([^}]*)}/g, "__$1__")
                               .replace(/{@damage ([^}]*)}/g, "$1")
                               .replace(/{@item ([^}]*)}/g, "$1");
            
            result += processed + " ";
        } else if (entry.type === "list") {
            result += entry.items.map(item => `• ${item}`).join("\n");
        }
    }
    
    return result.trim();
}

function processAttacks(attacks: Pf2eToolsCreature["attacks"]): Trait[] {
    return attacks.map(attack => {
        const traits = attack.traits ? ` (${attack.traits.join(", ")})` : "";
        const damage = attack.damage ? ` __Damage__ ${attack.damage.replace(/{@damage ([^}]*)}/g, "$1")}` : "";
        
        return {
            name: attack.range,
            desc: ONE_ACTION + ` ${attack.name} ${addSign(attack.attack)}${traits}${damage}`
        };
    });
}

function processSpellcasting(spellcasting: Pf2eToolsCreature["spellcasting"]): Trait[] {
    return spellcasting.map(casting => {
        const name = casting.name || casting.type;
        let description = "";
        
        if (casting.tradition) description += `${casting.tradition} `;
        if (casting.DC) description += `DC ${casting.DC}; `;
        if (casting.fp) description += `${casting.fp} Focus Points; `;
        
        // Process spells by level
        const spellLevels = Object.keys(casting.entry);
        for (const levelKey of spellLevels) {
            const levelData = casting.entry[levelKey];
            const level = levelData.level || parseInt(levelKey);
            const spellNames = levelData.spells.map(s => s.name).join(", ");
            
            if (levelKey === "0") {
                description += `__Cantrips (${level})__ ${spellNames}; `;
            } else {
                description += `__Level ${levelKey}__ ${spellNames}; `;
            }
        }
        
        return {
            name,
            desc: description.trim()
        };
    });
}

function processSkills(skills: Record<string, { std: number; note?: string }>): Trait[] {
    const skillEntries = Object.entries(skills).map(([name, data]) => {
        const skillName = toTitleCase(name);
        const value = data.std;
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

function getSizeString(traits: string[]): string {
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

function getActionIcon(ability: Ability): string {
    if (!ability.activity) return "";
    
    const { number, unit } = ability.activity;
    
    if (unit === "action") {
        if (number === 1) return ONE_ACTION;
        if (number === 2) return "⬺ ";
        if (number === 3) return "⬽ ";
    } else if (unit === "reaction") {
        return "⬲ ";
    } else if (unit === "free") {
        return "⭓ ";
    }
    
    return "";
}
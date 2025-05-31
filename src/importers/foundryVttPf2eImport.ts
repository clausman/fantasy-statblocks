import { Monster, Trait } from "../../index";
import { ONE_ACTION, addSign, getACStats, getModifierToDiceRoll, toTitleCase } from "./pf2eMonsterToolImport";

/**
 * Interface for FoundryVTT PF2e creature data format
 * Based on typical FoundryVTT data structure patterns
 */
export interface FoundryVttPf2eCreature {
    _id?: string;
    name: string;
    type: "npc" | "character";
    system: {
        details: {
            level: {
                value: number;
            };
            creatureType?: string;
            alignment?: {
                value: string;
            };
            source?: {
                value: string;
            };
        };
        traits: {
            size: {
                value: string;
            };
            value: string[];
            rarity?: {
                value: string;
            };
        };
        attributes: {
            hp: {
                value: number;
                max: number;
                details?: string;
            };
            ac: {
                value: number;
                details?: string;
            };
            perception: {
                value: number;
                details?: string;
            };
            speed: {
                value: number;
                otherSpeeds?: Array<{
                    type: string;
                    value: number;
                }>;
                details?: string;
            };
        };
        abilities: {
            str: {
                mod: number;
            };
            dex: {
                mod: number;
            };
            con: {
                mod: number;
            };
            int: {
                mod: number;
            };
            wis: {
                mod: number;
            };
            cha: {
                mod: number;
            };
        };
        saves: {
            fortitude: {
                value: number;
            };
            reflex: {
                value: number;
            };
            will: {
                value: number;
            };
        };
        skills?: Record<string, {
            value: number;
            note?: string;
        }>;
        actions?: Array<{
            _id?: string;
            name: string;
            type: string;
            description?: {
                value: string;
            };
            system?: {
                actionType?: {
                    value: string;
                };
                actions?: {
                    value: number;
                };
                traits?: {
                    value: string[];
                };
            };
        }>;
        spellcasting?: {
            traditions?: string[];
            dc?: {
                value: number;
            };
            spells?: Record<string, {
                value: Array<{
                    name: string;
                    level?: number;
                }>;
            }>;
        };
        resources?: {
            immunities?: {
                value: string[];
            };
            resistances?: {
                value: Array<{
                    type: string;
                    value: number;
                    exceptions?: string[];
                }>;
            };
            weaknesses?: {
                value: Array<{
                    type: string;
                    value: number;
                    exceptions?: string[];
                }>;
            };
        };
    };
}

export async function buildMonsterFromFoundryVttPf2eFile(
    file: File
): Promise<Monster[]> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event: any) => {
            try {
                let data = JSON.parse(event.target.result);
                const monsters: Monster[] = [];

                // Handle different possible data structures
                let creatures: FoundryVttPf2eCreature[] = [];
                
                if (Array.isArray(data)) {
                    // Direct array of creatures
                    creatures = data;
                } else if (data.entries && Array.isArray(data.entries)) {
                    // FoundryVTT pack format with entries array
                    creatures = data.entries;
                } else if (typeof data === "object" && data.name) {
                    // Single creature object
                    creatures = [data];
                } else {
                    // Try to find creatures in nested objects
                    for (const key in data) {
                        const value = data[key];
                        if (Array.isArray(value)) {
                            // Check if this array contains creature-like objects
                            if (value.length > 0 && value[0].name && value[0].system) {
                                creatures = value;
                                break;
                            }
                        }
                    }
                }

                // Convert each creature, with error tolerance
                for (const creatureData of creatures) {
                    try {
                        // Skip if not a valid creature
                        if (!creatureData || !creatureData.name || !creatureData.system) {
                            console.warn("Skipping invalid creature data:", creatureData);
                            continue;
                        }
                        
                        // Only process NPCs and characters
                        if (creatureData.type && !["npc", "character"].includes(creatureData.type)) {
                            console.warn(`Skipping non-creature type: ${creatureData.type}`);
                            continue;
                        }

                        const monster = convertFoundryVttPf2eCreatureToMonster(creatureData);
                        monsters.push(monster);
                    } catch (error) {
                        console.error(`Error converting creature ${creatureData?.name || 'unknown'}:`, error);
                        // Continue processing other creatures
                    }
                }

                resolve(monsters);
            } catch (e) {
                console.error(`Error parsing FoundryVTT PF2e file:`, e);
                // Return empty array instead of rejecting to be error tolerant
                resolve([]);
            }
        };
        reader.readAsText(file);
    });
}

export function convertFoundryVttPf2eCreatureToMonster(creature: FoundryVttPf2eCreature): Monster {
    // Extract basic information with safe defaults
    const name = creature.name || "Unknown Creature";
    const level = creature.system?.details?.level?.value ?? 0;
    const creatureType = creature.system?.details?.creatureType || "humanoid";
    const alignment = creature.system?.details?.alignment?.value || "N";
    const size = creature.system?.traits?.size?.value || "Medium";
    const source = creature.system?.details?.source?.value || "Unknown";
    
    // Extract ability modifiers
    const abilities = creature.system?.abilities || {};
    const stats: [number, number, number, number, number, number] = [
        (abilities as any).str?.mod ?? 0,
        (abilities as any).dex?.mod ?? 0,
        (abilities as any).con?.mod ?? 0,
        (abilities as any).int?.mod ?? 0,
        (abilities as any).wis?.mod ?? 0,
        (abilities as any).cha?.mod ?? 0
    ];

    // Extract core attributes
    const ac = creature.system?.attributes?.ac?.value ?? 10;
    const hp = creature.system?.attributes?.hp?.max ?? creature.system?.attributes?.hp?.value ?? 1;
    const hpDetails = creature.system?.attributes?.hp?.details || "";
    const perception = creature.system?.attributes?.perception?.value ?? 0;
    const perceptionDetails = creature.system?.attributes?.perception?.details || "";

    // Extract saves
    const saves = creature.system?.saves || {};
    const fortitude = (saves as any).fortitude?.value ?? 0;
    const reflex = (saves as any).reflex?.value ?? 0;
    const will = (saves as any).will?.value ?? 0;

    // Build speed string
    const speedData = creature.system?.attributes?.speed;
    let speedString = `${speedData?.value ?? 25} feet`;
    if (speedData?.otherSpeeds && speedData.otherSpeeds.length > 0) {
        const otherSpeeds = speedData.otherSpeeds
            .map(s => `${s.type} ${s.value} feet`)
            .join(", ");
        speedString += `, ${otherSpeeds}`;
    }
    if (speedData?.details) {
        speedString += ` (${speedData.details})`;
    }

    // Extract traits
    const traits = creature.system?.traits?.value || [];
    
    // Process skills
    const skills = processFoundryVttSkills(creature.system?.skills || {});
    
    // Process actions/abilities
    const actions = creature.system?.actions || [];
    const { abilities_top, abilities_mid, abilities_bot, attacks, spellcasting } = 
        processFoundryVttActions(actions);
    
    // Process immunities, resistances, weaknesses
    const resources = creature.system?.resources || {};
    const immunities = (resources.immunities?.value || []).join(", ");
    const resistances = (resources.resistances?.value || [])
        .map(r => `${r.type} ${r.value}${r.exceptions ? ` (except ${r.exceptions.join(", ")})` : ""}`)
        .join(", ");
    const weaknesses = (resources.weaknesses?.value || [])
        .map(w => `${w.type} ${w.value}${w.exceptions ? ` (except ${w.exceptions.join(", ")})` : ""}`)
        .join(", ");

    // Create the monster object
    const monster: Monster = {
        layout: "Basic Pathfinder 2e Layout",
        name,
        level: `Creature ${level}`,
        size: toTitleCase(size),
        trait_03: toTitleCase(creatureType),
        modifier: perception,
        perception: [{
            name: "Perception",
            desc: `Perception ${addSign(perception)}${perceptionDetails ? `; ${perceptionDetails}` : ""}`
        }],
        abilities_top,
        abilities_mid,
        abilities_bot,
        type: toTitleCase(creatureType),
        subtype: "",
        alignment: alignment,
        ac,
        armorclass: getACStats(ac, fortitude, reflex, will),
        hp,
        health: [{
            name: "HP",
            desc: `${hp}${hpDetails ? ` (${hpDetails})` : ""}${immunities ? `; __Immunities__ ${immunities}` : ""}${resistances ? `; __Resistances__ ${resistances}` : ""}${weaknesses ? `; __Weaknesses__ ${weaknesses}` : ""}`
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
        senses: perceptionDetails,
        languages: "", // TODO: Extract from creature data if available
        cr: level,
        bestiary: false,
        skills,
        source
    };

    // Add traits starting from trait_04
    for (let i = 0; i < traits.length; i++) {
        const traitIndexStr = (i + 4).toString().padStart(2, '0');
        const traitKeyString = `trait_${traitIndexStr}`;
        monster[traitKeyString] = traits[i];
    }

    return monster;
}

function processFoundryVttSkills(skills: Record<string, { value: number; note?: string }>): Trait[] {
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

function processFoundryVttActions(actions: Array<{
    _id?: string;
    name: string;
    type: string;
    description?: { value: string };
    system?: {
        actionType?: { value: string };
        actions?: { value: number };
        traits?: { value: string[] };
    };
}>): {
    abilities_top: Trait[];
    abilities_mid: Trait[];
    abilities_bot: Trait[];
    attacks: Trait[];
    spellcasting: Trait[];
} {
    const abilities_top: Trait[] = [];
    const abilities_mid: Trait[] = [];
    const abilities_bot: Trait[] = [];
    const attacks: Trait[] = [];
    const spellcasting: Trait[] = [];

    for (const action of actions) {
        try {
            const name = action.name || "Unknown Action";
            const description = action.description?.value || "";
            const actionType = action.system?.actionType?.value || action.type;
            const numActions = action.system?.actions?.value;
            const traits = action.system?.traits?.value || [];

            // Get action icon
            let actionIcon = "";
            if (numActions === 1) actionIcon = ONE_ACTION;
            else if (numActions === 2) actionIcon = "⬺ ";
            else if (numActions === 3) actionIcon = "⬽ ";
            else if (actionType === "reaction") actionIcon = "⬲ ";
            else if (actionType === "free") actionIcon = "⭓ ";

            const desc = actionIcon + description;
            const trait: Trait = { name, desc };

            // Categorize actions based on type
            if (actionType === "strike" || actionType === "attack") {
                attacks.push(trait);
            } else if (actionType === "spellcasting" || name.toLowerCase().includes("spell")) {
                spellcasting.push(trait);
            } else if (actionType === "passive" || traits.includes("passive")) {
                abilities_top.push(trait);
            } else if (actionType === "defensive" || traits.includes("defensive")) {
                abilities_mid.push(trait);
            } else {
                abilities_bot.push(trait);
            }
        } catch (error) {
            console.error(`Error processing action ${action?.name || 'unknown'}:`, error);
            // Continue processing other actions
        }
    }

    return { abilities_top, abilities_mid, abilities_bot, attacks, spellcasting };
}
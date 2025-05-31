import { buildMonsterFromFoundryVttPf2eFile, convertFoundryVttPf2eCreatureToMonster, FoundryVttPf2eCreature } from '../../src/importers/foundryVttPf2eImport';
import { Monster } from '../../index';
import * as fs from 'fs';
import * as path from 'path';

describe('FoundryVTT PF2e Importer', () => {
    // Load test data
    const testDataPath = path.resolve(__dirname, '../../tmp/foundry-pf2e-test-data.json');
    const jsonData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
    
    // Test with the "Goblin Warrior" creature from the file
    const goblinData = jsonData.entries.find((c: any) => c.name === 'Goblin Warrior');
    
    test('should convert Goblin Warrior creature correctly', () => {
        // Convert the creature
        const monster = convertFoundryVttPf2eCreatureToMonster(goblinData);
        
        // Basic assertions for the conversion
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Goblin Warrior');
        expect(monster.level).toBe('Creature 1');
        expect(monster.size).toBe('Small');
        expect(monster.type).toBe('Humanoid');
        
        // Check ability modifiers
        expect(monster.stats).toEqual([2, 3, 1, 0, 1, -1]);
        
        // Check defenses
        expect(monster.ac).toBe(16);
        expect(monster.hp).toBe(18);
        
        // Check perception
        expect(monster.modifier).toBe(5);
        expect(monster.perception).toHaveLength(1);
        expect(monster.perception[0].desc).toContain('Perception +5');
        expect(monster.perception[0].desc).toContain('darkvision');
        
        // Check saves (armorclass is an array with AC info)
        expect(monster.armorclass).toHaveLength(1);
        expect(monster.armorclass[0].desc).toContain('__Fort__: +6');
        expect(monster.armorclass[0].desc).toContain('__Ref__: +8');
        expect(monster.armorclass[0].desc).toContain('__Will__: +4');
        
        // Check skills
        expect(monster.skills).toHaveLength(1);
        expect(monster.skills[0].desc).toContain('Acrobatics');
        expect(monster.skills[0].desc).toContain('Athletics');
        expect(monster.skills[0].desc).toContain('Stealth');
        
        // Check attacks/actions
        expect(monster.attacks).toHaveLength(1);
        expect(monster.attacks[0].name).toBe('Dogslicer');
        expect(monster.attacks[0].desc).toContain('1d6+2 slashing');
        
        // Check that it has abilities (should include Goblin Scuttle)
        const totalAbilities = monster.abilities_top.length + monster.abilities_mid.length + monster.abilities_bot.length;
        expect(totalAbilities).toBeGreaterThan(0);
        
        // Check source
        expect(monster.source).toBe('Pathfinder Monster Core');
    });

    test('should handle minimal creature data', () => {
        const minimalCreature: FoundryVttPf2eCreature = {
            name: "Test Creature",
            type: "npc",
            system: {
                details: {
                    level: { value: 0 }
                },
                traits: {
                    size: { value: "medium" },
                    value: []
                },
                attributes: {
                    hp: { value: 10, max: 10 },
                    ac: { value: 10 },
                    perception: { value: 0 },
                    speed: { value: 30 }
                },
                abilities: {
                    str: { mod: 0 },
                    dex: { mod: 0 },
                    con: { mod: 0 },
                    int: { mod: 0 },
                    wis: { mod: 0 },
                    cha: { mod: 0 }
                },
                saves: {
                    fortitude: { value: 0 },
                    reflex: { value: 0 },
                    will: { value: 0 }
                }
            }
        };
        
        const monster = convertFoundryVttPf2eCreatureToMonster(minimalCreature);
        
        expect(monster.name).toBe("Test Creature");
        expect(monster.level).toBe("Creature 0");
        expect(monster.size).toBe("Medium");
        expect(monster.hp).toBe(10);
        expect(monster.ac).toBe(10);
        expect(monster.stats).toEqual([0, 0, 0, 0, 0, 0]);
    });

    test('should handle completely invalid creature data gracefully', () => {
        const invalidCreature = {
            name: "Invalid",
            // Missing required system data
        } as any;
        
        // Should not throw, but should use defaults for missing data
        const monster = convertFoundryVttPf2eCreatureToMonster(invalidCreature);
        expect(monster.name).toBe("Invalid");
        expect(monster.level).toBe("Creature 0"); // default level
        expect(monster.hp).toBe(1); // default hp
    });

    describe('Error handling in creature conversion', () => {
        test('should skip invalid creatures and process valid ones', () => {
            // Mock console.error to capture error messages
            const originalConsoleError = console.error;
            const mockConsoleError = jest.fn();
            console.error = mockConsoleError;
            
            const monsters: any[] = [];
            
            // Mixed array of valid and invalid creatures
            const creatures = [
                goblinData, // Valid creature
                { // Invalid creature - missing system
                    name: "Invalid Creature",
                    type: "npc"
                },
                {
                    name: "Valid Creature",
                    type: "npc",
                    system: {
                        details: { level: { value: 1 } },
                        traits: { size: { value: "medium" }, value: [] },
                        attributes: {
                            hp: { value: 15, max: 15 },
                            ac: { value: 12 },
                            perception: { value: 2 },
                            speed: { value: 25 }
                        },
                        abilities: {
                            str: { mod: 1 }, dex: { mod: 1 }, con: { mod: 1 },
                            int: { mod: 1 }, wis: { mod: 1 }, cha: { mod: 1 }
                        },
                        saves: {
                            fortitude: { value: 3 },
                            reflex: { value: 3 },
                            will: { value: 3 }
                        }
                    }
                } as FoundryVttPf2eCreature
            ];
            
            // Simulate the conversion loop from buildMonsterFromFoundryVttPf2eFile
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

                    const monster = convertFoundryVttPf2eCreatureToMonster(creatureData as FoundryVttPf2eCreature);
                    monsters.push(monster);
                } catch (error) {
                    console.error(`Error converting creature ${creatureData?.name || 'unknown'}:`, error);
                    // Continue processing other creatures
                }
            }
            
            // Restore console.error
            console.error = originalConsoleError;
            
            // Should have converted 2 valid creatures (Goblin Warrior and Valid Creature)
            expect(monsters.length).toBe(2);
            expect(monsters[0].name).toBe('Goblin Warrior');
            expect(monsters[1].name).toBe('Valid Creature');
        });
    });
});
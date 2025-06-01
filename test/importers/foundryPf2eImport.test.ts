import { buildMonsterFromFoundryPf2eFile, convertFoundryPf2eCreatureToMonster, FoundryPf2eCreature } from '../../src/importers/foundryPf2eImport';
import { Monster } from '../../index';
import * as fs from 'fs';
import * as path from 'path';

describe('convertFoundryPf2eCreatureToMonster', () => {
    // Load test data from the foundry-pf2e-multiple.json file
    const testDataPath = path.resolve(__dirname, '../../tmp/foundry-pf2e-multiple.json');
    const jsonData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
    
    // Test with the "Adult Red Dragon" creature from the file
    const dragonData = jsonData.find((c: any) => c.name === 'Adult Red Dragon');
    
    test('should convert Adult Red Dragon correctly', () => {
        // Convert the creature
        const monster = convertFoundryPf2eCreatureToMonster(dragonData);
        
        // Basic assertions for the conversion
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Adult Red Dragon');
        expect(monster.level).toBe('Creature 14');
        expect(monster.size).toBe('Large');
        expect(monster.type).toBe('Dragon');
        
        // Check ability modifiers
        expect(monster.stats).toEqual([8, 2, 6, 4, 4, 6]);
        
        // Check defenses
        expect(monster.ac).toBe(36);
        expect(monster.hp).toBe(307);
        
        // Check saves
        expect(monster.armorclass).toHaveLength(1);
        expect(monster.armorclass[0].desc).toContain('36');
        expect(monster.armorclass[0].desc).toContain('28'); // Fort
        expect(monster.armorclass[0].desc).toContain('24'); // Ref
        expect(monster.armorclass[0].desc).toContain('26'); // Will
        
        // Check perception
        expect(monster.perception).toHaveLength(1);
        expect(monster.perception[0].desc).toContain('+26');
        
        // Check speed
        expect(monster.speed).toBe('60 feet, fly 180 feet');
        
        // Check source
        expect(monster.source).toBe('Pathfinder Bestiary');
        
        // Check traits
        expect(monster.trait_04).toBe('dragon');
        expect(monster.trait_05).toBe('fire');
        expect(monster.trait_06).toBe('large');
        
        // Check damage immunities/resistances/weaknesses
        expect(monster.damage_immunities).toContain('fire');
        expect(monster.damage_resistances).toContain('cold 10');
        expect(monster.damage_vulnerabilities).toContain('cold 15');
    });

    // Test with the "Goblin Warrior" creature from the file
    const goblinData = jsonData.find((c: any) => c.name === 'Goblin Warrior');
    
    test('should convert Goblin Warrior correctly', () => {
        // Convert the creature
        const monster = convertFoundryPf2eCreatureToMonster(goblinData);
        
        // Basic assertions for the conversion
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Goblin Warrior');
        expect(monster.level).toBe('Creature -1');
        expect(monster.size).toBe('Small');
        expect(monster.type).toBe('Humanoid');
        
        // Check ability modifiers
        expect(monster.stats).toEqual([0, 3, 1, 0, 1, -1]);
        
        // Check defenses
        expect(monster.ac).toBe(16);
        expect(monster.hp).toBe(6);
        
        // Check skills
        expect(monster.skills).toHaveLength(1);
        expect(monster.skills[0].desc).toContain('Acrobatics');
        expect(monster.skills[0].desc).toContain('Athletics');
        expect(monster.skills[0].desc).toContain('Nature');
        expect(monster.skills[0].desc).toContain('Stealth');
    });

    // Edge case: Test with minimal required creature data
    test('should handle minimal creature data', () => {
        const minimalCreature: FoundryPf2eCreature = {
            name: 'Minimal Creature',
            system: {
                details: {
                    level: {
                        value: 1
                    }
                },
                attributes: {
                    ac: {
                        value: 10
                    },
                    hp: {
                        value: 10
                    },
                    perception: {
                        value: 0
                    }
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
        
        const monster = convertFoundryPf2eCreatureToMonster(minimalCreature);
        
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Minimal Creature');
        expect(monster.level).toBe('Creature 1');
        expect(monster.hp).toBe(10);
        expect(monster.ac).toBe(10);
        expect(monster.size).toBe('Medium'); // Default
        expect(monster.type).toBe('Humanoid'); // Default
        expect(monster.source).toBe('FoundryVTT PF2e'); // Default
    });
    
    // Test error handling: Test with invalid creature data that will cause an error
    test('should throw an error with invalid creature data', () => {
        const invalidCreature: any = {
            name: 'Invalid Creature',
            system: {
                details: {
                    level: {
                        value: 1
                    }
                },
                attributes: {
                    // Missing required fields like ac, hp, perception
                },
                abilities: {
                    // Missing required ability scores
                    str: { mod: 0 },
                    dex: { mod: 0 }
                    // con, int, wis, cha are missing
                }
                // Missing saves
            }
        };
        
        expect(() => {
            convertFoundryPf2eCreatureToMonster(invalidCreature);
        }).toThrow();
    });
});

// Test the buildMonsterFromFoundryPf2eFile function
describe('buildMonsterFromFoundryPf2eFile', () => {
    test('should process file with multiple creatures', async () => {
        // Create a mock file with the test data
        const testDataPath = path.resolve(__dirname, '../../tmp/foundry-pf2e-multiple.json');
        const jsonContent = fs.readFileSync(testDataPath, 'utf-8');
        
        const mockFile = new File([jsonContent], 'test-creatures.json', {
            type: 'application/json'
        });
        
        const monsters = await buildMonsterFromFoundryPf2eFile(mockFile);
        
        expect(monsters).toHaveLength(2);
        expect(monsters[0].name).toBe('Adult Red Dragon');
        expect(monsters[1].name).toBe('Goblin Warrior');
    });
    
    test('should handle single creature object', async () => {
        const singleCreature = {
            name: 'Test Creature',
            system: {
                details: {
                    level: { value: 1 }
                },
                attributes: {
                    ac: { value: 15 },
                    hp: { value: 20 },
                    perception: { value: 5 }
                },
                abilities: {
                    str: { mod: 1 },
                    dex: { mod: 2 },
                    con: { mod: 1 },
                    int: { mod: 0 },
                    wis: { mod: 1 },
                    cha: { mod: 0 }
                },
                saves: {
                    fortitude: { value: 5 },
                    reflex: { value: 6 },
                    will: { value: 4 }
                }
            }
        };
        
        const mockFile = new File([JSON.stringify(singleCreature)], 'single-creature.json', {
            type: 'application/json'
        });
        
        const monsters = await buildMonsterFromFoundryPf2eFile(mockFile);
        
        expect(monsters).toHaveLength(1);
        expect(monsters[0].name).toBe('Test Creature');
    });
});

// Test error handling in the creature conversion loop
describe('Error handling in creature conversion', () => {
    test('should skip invalid creatures and process valid ones', async () => {
        // Mock console.error to capture calls
        const originalConsoleError = console.error;
        const mockConsoleError = jest.fn();
        console.error = mockConsoleError;
        
        // Mixed array of valid and invalid creatures
        const creatures = [
            // Valid creature
            {
                name: 'Valid Creature',
                system: {
                    details: { level: { value: 1 } },
                    attributes: {
                        ac: { value: 10 },
                        hp: { value: 10 },
                        perception: { value: 0 }
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
            },
            // Invalid creature - missing system
            {
                name: 'Invalid Creature'
            }
        ];
        
        const mockFile = new File([JSON.stringify(creatures)], 'mixed-creatures.json', {
            type: 'application/json'
        });
        
        const monsters = await buildMonsterFromFoundryPf2eFile(mockFile);
        
        // Restore console.error
        console.error = originalConsoleError;
        
        // Verify that one monster was successfully converted
        expect(monsters.length).toBe(1);
        expect(monsters[0].name).toBe('Valid Creature');
        
        // Verify that console.error was called for the invalid creature
        expect(mockConsoleError).toHaveBeenCalled();
        expect(mockConsoleError.mock.calls[0][0]).toContain('Error converting creature Invalid Creature');
    });
});
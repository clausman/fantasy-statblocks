import { buildMonsterFromPf2eToolsFile, convertPf2eToolsCreatureToMonster, Pf2eToolsCreature } from '../../src/importers/pf2eToolsImport';
import { Monster } from '../../index';
import * as fs from 'fs';
import * as path from 'path';

// Helper to access private function for testing
// This is a workaround since convertPf2eToolsCreatureToMonster is not exported in the original file
declare module '../../src/importers/pf2eToolsImport' {
    export function convertPf2eToolsCreatureToMonster(creature: Pf2eToolsCreature): any;
}

describe('convertPf2eToolsCreatureToMonster', () => {
    // Load test data from the creatures-afof.json file
    const testDataPath = path.resolve(__dirname, '../../tmp/creatures-afof.json');
    const jsonData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
    
    // Test with the "Darius" creature from the file
    const dariusData = jsonData.creature.find((c: any) => c.name === 'Darius');
    
    test('should convert Darius creature correctly', () => {
        // Convert the creature
        const monster = convertPf2eToolsCreatureToMonster(dariusData);
        
        // Basic assertions for the conversion
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Darius');
        expect(monster.level).toBe('Creature 3');
        expect(monster.size).toBe('Medium');
        
        // Check ability modifiers
        expect(monster.stats).toEqual([3, 1, 2, 3, 0, 1]);
        
        // Check defenses
        expect(monster.ac).toBe(18);
        expect(monster.hp).toBe(45);
        
        // Check attacks
        expect(monster.attacks).toHaveLength(3);
        expect(monster.attacks[0].name).toBe('Melee');
        expect(monster.attacks[0].desc).toContain('jaws +12');
        
        // Check abilities
        expect(monster.abilities_mid).toHaveLength(1);
        expect(monster.abilities_mid[0].name).toBe('Metabolize Mutagen');
        
        expect(monster.abilities_bot).toHaveLength(2);
        expect(monster.abilities_bot[0].name).toBe('Crystalline Mutation');
        expect(monster.abilities_bot[1].name).toBe('Spray Hot Wax');
    });

    // Test with the "Scented Candle Homunculus" creature from the file
    const homunculus = jsonData.creature.find((c: any) => c.name === 'Scented Candle Homunculus');
    
    test('should convert Scented Candle Homunculus correctly', () => {
        // Protect against undefined data
        if (!homunculus) {
            console.warn('Test data not found for Scented Candle Homunculus');
            return;
        }

        // Convert the creature
        const monster = convertPf2eToolsCreatureToMonster(homunculus);
        
        // Basic assertions for the conversion
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Scented Candle Homunculus');
        expect(monster.level).toBe('Creature 1');
        expect(monster.size).toBe('Tiny');
        expect(monster.type).toBe('Construct');
        
        // Check senses
        expect(monster.senses).toContain('darkvision');
    });

    // Edge case: Test with minimal required creature data
    test('should handle minimal creature data', () => {
        const minimalCreature: Pf2eToolsCreature = {
            name: 'Minimal Creature',
            source: 'Test',
            level: 1,
            traits: ['medium', 'humanoid'],
            perception: {
                std: 0
            },
            abilityMods: {
                str: 0,
                dex: 0,
                con: 0,
                int: 0,
                wis: 0,
                cha: 0
            },
            speed: {},
            defenses: {
                ac: {
                    std: 10
                },
                savingThrows: {
                    fort: { std: 0 },
                    ref: { std: 0 },
                    will: { std: 0 }
                },
                hp: [{ hp: 10 }]
            }
        };
        
        const monster = convertPf2eToolsCreatureToMonster(minimalCreature);
        
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Minimal Creature');
        expect(monster.level).toBe('Creature 1');
        expect(monster.hp).toBe(10);
        expect(monster.ac).toBe(10);
    });
    
    // Test error handling: Test with invalid creature data that will cause an error
    test('should throw an error with invalid creature data', () => {
        const invalidCreature: any = {
            name: 'Invalid Creature',
            source: 'Test',
            level: 1,
            traits: ['medium', 'humanoid'],
            perception: {
                std: 0
            },
            abilityMods: {
                // Missing required ability scores
                str: 0,
                dex: 0
                // con, int, wis, cha are missing
            },
            speed: {},
            // Missing defenses
        };
        
        expect(() => {
            convertPf2eToolsCreatureToMonster(invalidCreature);
        }).toThrow();
    });
});

// Test the error handling in the creature conversion loop
describe('Error handling in creature conversion', () => {
    test('should skip invalid creatures and process valid ones', () => {
        // Mock console.error to capture calls
        const originalConsoleError = console.error;
        const mockConsoleError = jest.fn();
        console.error = mockConsoleError;
        
        const monsters: any[] = [];
        
        // Mixed array of valid and invalid creatures
        const creatures = [
            // Valid creature - use correct typing
            {
                name: 'Valid Creature',
                source: 'Test',
                level: 1,
                traits: ['medium', 'humanoid'],
                perception: { std: 0 },
                abilityMods: {
                    str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0
                },
                speed: {},
                defenses: {
                    ac: { std: 10 },
                    savingThrows: {
                        fort: { std: 0 },
                        ref: { std: 0 },
                        will: { std: 0 }
                    },
                    hp: [{ hp: 10 }]
                }
            } as Pf2eToolsCreature,
            // Invalid creature - use 'as any' to bypass type checking
            {
                name: 'Invalid Creature',
                source: 'Test',
                level: 1,
                // Missing many required fields
            } as any
        ];
        
        // Simulate the conversion loop from buildMonsterFromPf2eToolsFile
        for (const creatureData of creatures) {
            try {
                monsters.push(convertPf2eToolsCreatureToMonster(creatureData));
            } catch (error) {
                console.error(`Error converting creature ${creatureData.name || 'unknown'}:`, error);
                // Skip this monster and continue with the next one
            }
        }
        
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
import { buildMonsterFromFoundryPf2eFile, convertFoundryPf2eActorToMonster, FoundryPf2eActor } from '../../src/importers/foundryPf2eImport';
import { Monster } from '../../index';
import * as fs from 'fs';
import * as path from 'path';

// Mock FileReader for Node.js environment
global.FileReader = class {
    result: string | null = null;
    onload: ((event: any) => void) | null = null;
    
    readAsText(file: any) {
        setTimeout(() => {
            // For test purposes, treat the file content directly as text
            if (file && typeof file.text === 'function') {
                file.text().then((text: string) => {
                    this.result = text;
                    if (this.onload) {
                        this.onload({ target: { result: this.result } });
                    }
                });
            } else {
                // Fallback for mock File objects
                this.result = String(file);
                if (this.onload) {
                    this.onload({ target: { result: this.result } });
                }
            }
        }, 0);
    }
} as any;

// Ensure File is available in test environment
if (!global.File) {
    global.File = class {
        constructor(public content: any[], public name: string, public options: any) {}
        
        text() {
            return Promise.resolve(this.content[0]);
        }
        
        toString() {
            return this.content[0];
        }
    } as any;
}

describe('convertFoundryPf2eActorToMonster', () => {
    // Load test data from the foundry files
    const testDataPath1 = path.resolve(__dirname, '../../tmp/foundry-aapoph-granitescale.json');
    const testDataPath2 = path.resolve(__dirname, '../../tmp/foundry-aapoph-serpentfolk.json');
    const foundryData1 = JSON.parse(fs.readFileSync(testDataPath1, 'utf-8'));
    const foundryData2 = JSON.parse(fs.readFileSync(testDataPath2, 'utf-8'));
    
    test('should convert Aapoph Granitescale creature correctly', () => {
        // Convert the creature
        const monster = convertFoundryPf2eActorToMonster(foundryData1);
        
        // Basic assertions for the conversion
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Aapoph Granitescale');
        expect(monster.level).toBe('Creature 6');
        expect(monster.size).toBe('Medium');
        
        // Check ability modifiers
        expect(monster.stats).toEqual([5, 4, 4, -1, 1, 1]);
        
        // Check defenses
        expect(monster.ac).toBe(24);
        expect(monster.hp).toBe(120);
        
        // Check that speed is processed correctly
        expect(monster.speed).toContain('25 feet');
        
        // Check source
        expect(monster.source).toBe('Pathfinder Monster Core');
    });

    test('should convert Aapoph Serpentfolk creature correctly', () => {
        // Convert the creature  
        const monster = convertFoundryPf2eActorToMonster(foundryData2);
        
        // Basic assertions for the conversion
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Aapoph Serpentfolk');
        expect(monster.level).toBe('Creature 3');
        expect(monster.size).toBe('Medium');
        
        // Check that it has valid ability modifiers
        expect(monster.stats).toHaveLength(6);
        expect(monster.stats.every(stat => typeof stat === 'number')).toBe(true);
        
        // Check that basic stats are present
        expect(typeof monster.ac).toBe('number');
        expect(typeof monster.hp).toBe('number');
        expect(monster.speed).toBeTruthy();
    });

    test('should handle minimal creature data', () => {
        const minimalCreature: FoundryPf2eActor = {
            _id: "test123",
            name: "Test Creature",
            type: "npc",
            system: {
                abilities: {
                    str: { mod: 1, value: 12 },
                    dex: { mod: 2, value: 14 },
                    con: { mod: 1, value: 12 },
                    int: { mod: 0, value: 10 },
                    wis: { mod: 1, value: 12 },
                    cha: { mod: 0, value: 10 }
                },
                attributes: {
                    ac: { value: 16 },
                    hp: { value: 25, max: 25 },
                    speed: { value: 25 }
                },
                details: {
                    level: { value: 1 }
                },
                traits: {
                    value: ["humanoid"],
                    size: { value: "med" }
                },
                saves: {
                    fortitude: { value: 8 },
                    reflex: { value: 9 },
                    will: { value: 6 }
                }
            }
        };
        
        const monster = convertFoundryPf2eActorToMonster(minimalCreature);
        
        expect(monster).toBeDefined();
        expect(monster.name).toBe('Test Creature');
        expect(monster.level).toBe('Creature 1');
        expect(monster.size).toBe('Medium');
        expect(monster.ac).toBe(16);
        expect(monster.hp).toBe(25);
    });

    test('should throw an error with invalid creature data', () => {
        const invalidCreature = {
            _id: "invalid",
            name: "Invalid Creature", 
            type: "npc",
            system: null // Invalid system data
        } as any;
        
        expect(() => {
            convertFoundryPf2eActorToMonster(invalidCreature);
        }).toThrow();
    });
});

describe('Error handling in creature conversion', () => {
    test('should skip invalid creatures and process valid ones', () => {
        // Mock console.error to capture error messages
        const originalConsoleError = console.error;
        const mockConsoleError = jest.fn();
        console.error = mockConsoleError;
        
        // Create a mock file with mixed valid and invalid data
        const mockFileContent = JSON.stringify([
            {
                _id: "valid1",
                name: "Valid Creature",
                type: "npc",
                system: {
                    abilities: {
                        str: { mod: 1, value: 12 },
                        dex: { mod: 2, value: 14 },
                        con: { mod: 1, value: 12 },
                        int: { mod: 0, value: 10 },
                        wis: { mod: 1, value: 12 },
                        cha: { mod: 0, value: 10 }
                    },
                    attributes: {
                        ac: { value: 16 },
                        hp: { value: 25, max: 25 },
                        speed: { value: 25 }
                    },
                    details: {
                        level: { value: 1 }
                    },
                    traits: {
                        value: ["humanoid"],
                        size: { value: "med" }
                    },
                    saves: {
                        fortitude: { value: 8 },
                        reflex: { value: 9 },
                        will: { value: 6 }
                    }
                }
            },
            {
                _id: "invalid1",
                name: "Invalid Creature",
                type: "npc",
                system: null // This will cause an error
            }
        ]);
        
        // Create a mock file
        const mockFile = new File([mockFileContent], 'test.json', { type: 'application/json' });
        
        return buildMonsterFromFoundryPf2eFile(mockFile).then(monsters => {
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
});
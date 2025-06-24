import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Test constants matching contract parameters
const DILITHIUM_PUBLIC_KEY_SIZE = 1312;
const DILITHIUM_SIGNATURE_SIZE = 2420;
const SPHINCS_PUBLIC_KEY_SIZE = 32;
const SPHINCS_SIGNATURE_SIZE = 17088;
const KYBER_PUBLIC_KEY_SIZE = 800;
const KYBER_CIPHERTEXT_SIZE = 768;

// Helper functions for generating test data
function generateDilithiumKey(): string {
    return '0x' + '01'.repeat(DILITHIUM_PUBLIC_KEY_SIZE);
}

function generateSPHINCSKey(): string {
    return '0x' + '02'.repeat(SPHINCS_PUBLIC_KEY_SIZE);
}

function generateKyberKey(): string {
    return '0x' + '03'.repeat(KYBER_PUBLIC_KEY_SIZE);
}

function generateDilithiumSignature(): string {
    return '0x' + '04'.repeat(DILITHIUM_SIGNATURE_SIZE);
}

function generateSPHINCSSignature(): string {
    return '0x' + '05'.repeat(SPHINCS_SIGNATURE_SIZE);
}

function generateKyberCiphertext(): string {
    return '0x' + '06'.repeat(KYBER_CIPHERTEXT_SIZE);
}

function generateHash32(): string {
    return '0x' + '07'.repeat(32);
}

function generateInvalidDilithiumKey(): string {
    return '0x' + '00'.repeat(DILITHIUM_PUBLIC_KEY_SIZE - 10); // Invalid size
}

// Test Suite: Quantum Key Registration
Clarinet.test({
    name: "Ensure that quantum keys can be registered successfully with valid parameters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 2);

        // Verify keys were stored correctly
        const getKeysResult = chain.callReadOnlyFn(
            'quantum-resistance-cryptographic',
            'get-quantum-keys',
            [types.principal(wallet1.address)],
            deployer.address
        );

        assertEquals(getKeysResult.result.includes('is-active: true'), true);
    },
});

Clarinet.test({
    name: "Ensure that quantum key registration fails with invalid Dilithium key size",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateInvalidDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u105)'); // ERR_INVALID_LATTICE_PARAMS
        assertEquals(block.height, 2);
    },
});

Clarinet.test({
    name: "Ensure that duplicate quantum key registration is prevented",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;

        // First registration should succeed
        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 2);

        // Second registration should fail
        block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // ERR_ALREADY_EXISTS
        assertEquals(block.height, 3);
    },
});

// Test Suite: Quantum Signature Operations
Clarinet.test({
    name: "Ensure that quantum signatures can be created after key registration",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const messageHash = generateHash32();

        // Register keys first
        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 2);

        // Create quantum signature
        block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-signature',
                [
                    types.buff(messageHash),
                    types.buff(generateDilithiumSignature()),
                    types.buff(generateSPHINCSSignature())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 3);
    },
});

Clarinet.test({
    name: "Ensure that quantum signature creation fails without registered keys",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const messageHash = generateHash32();

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-signature',
                [
                    types.buff(messageHash),
                    types.buff(generateDilithiumSignature()),
                    types.buff(generateSPHINCSSignature())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u104)'); // ERR_NOT_FOUND
        assertEquals(block.height, 2);
    },
});

Clarinet.test({
    name: "Ensure that duplicate quantum signatures are prevented",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const messageHash = generateHash32();

        // Register keys first
        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 2);

        // First signature creation should succeed
        block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-signature',
                [
                    types.buff(messageHash),
                    types.buff(generateDilithiumSignature()),
                    types.buff(generateSPHINCSSignature())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 3);

        // Duplicate signature should fail
        block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-signature',
                [
                    types.buff(messageHash),
                    types.buff(generateDilithiumSignature()),
                    types.buff(generateSPHINCSSignature())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u103)'); // ERR_ALREADY_EXISTS
        assertEquals(block.height, 4);
    },
});

// Test Suite: Encrypted Data Storage
Clarinet.test({
    name: "Ensure that encrypted data can be stored with valid parameters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const dataId = generateHash32();
        const metadataHash = generateHash32();

        // Register keys first
        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 2);

        // Store encrypted data
        block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'store-encrypted-data',
                [
                    types.buff(dataId),
                    types.buff(generateKyberCiphertext()),
                    types.buff(metadataHash)
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 3);
    },
});

Clarinet.test({
    name: "Ensure that encrypted data storage fails without registered keys",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const dataId = generateHash32();
        const metadataHash = generateHash32();

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'store-encrypted-data',
                [
                    types.buff(dataId),
                    types.buff(generateKyberCiphertext()),
                    types.buff(metadataHash)
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u104)'); // ERR_NOT_FOUND
        assertEquals(block.height, 2);
    },
});

// Test Suite: Merkle Root Operations
Clarinet.test({
    name: "Ensure that quantum-safe Merkle roots can be created by contract owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const rootHash = generateHash32();

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-merkle-root',
                [
                    types.uint(1),
                    types.buff(rootHash),
                    types.uint(10),
                    types.uint(1024)
                ],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok u1)');
        assertEquals(block.height, 2);

        // Verify merkle root was stored
        const getMerkleResult = chain.callReadOnlyFn(
            'quantum-resistance-cryptographic',
            'get-merkle-root',
            [types.uint(1)],
            deployer.address
        );

        assertEquals(getMerkleResult.result.includes('is-quantum-safe: true'), true);
    },
});

Clarinet.test({
    name: "Ensure that Merkle root creation fails for non-owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const rootHash = generateHash32();

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-merkle-root',
                [
                    types.uint(1),
                    types.buff(rootHash),
                    types.uint(10),
                    types.uint(1024)
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u100)'); // ERR_UNAUTHORIZED
        assertEquals(block.height, 2);
    },
});

// Test Suite: Hash Chain Operations
Clarinet.test({
    name: "Ensure that hash chains can be initialized and extended",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const chainId = generateHash32();
        const initialHash = generateHash32();
        const newData = generateHash32();

        // Initialize hash chain
        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'initialize-hash-chain',
                [
                    types.buff(chainId),
                    types.buff(initialHash)
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.startsWith('(ok 0x'), true);
        assertEquals(block.height, 2);

        // Extend hash chain
        block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'extend-hash-chain',
                [
                    types.buff(chainId),
                    types.buff(newData)
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.startsWith('(ok 0x'), true);
        assertEquals(block.height, 3);
    },
});

Clarinet.test({
    name: "Ensure that hash chain extension fails for non-existent chain",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const chainId = generateHash32();
        const newData = generateHash32();

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'extend-hash-chain',
                [
                    types.buff(chainId),
                    types.buff(newData)
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u104)'); // ERR_NOT_FOUND
        assertEquals(block.height, 2);
    },
});

// Test Suite: Quantum Threat Level Management
Clarinet.test({
    name: "Ensure that quantum threat level can be updated by contract owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'update-quantum-threat-level',
                [types.uint(5)],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok u5)');
        assertEquals(block.height, 2);

        // Verify threat level was updated
        const getThreatLevel = chain.callReadOnlyFn(
            'quantum-resistance-cryptographic',
            'get-quantum-threat-level',
            [],
            deployer.address
        );

        assertEquals(getThreatLevel.result, 'u5');
    },
});

Clarinet.test({
    name: "Ensure that quantum threat level update fails for excessive values",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'update-quantum-threat-level',
                [types.uint(15)], // Above threshold of 10
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u106)'); // ERR_QUANTUM_THRESHOLD_EXCEEDED
        assertEquals(block.height, 2);
    },
});

Clarinet.test({
    name: "Ensure that quantum threat level update fails for non-owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;

        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'update-quantum-threat-level',
                [types.uint(5)],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u100)'); // ERR_UNAUTHORIZED
        assertEquals(block.height, 2);
    },
});

// Test Suite: Key Deactivation
Clarinet.test({
    name: "Ensure that quantum keys can be deactivated by owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;

        // Register keys first
        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 2);

        // Deactivate keys
        block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'deactivate-quantum-keys',
                [],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.height, 3);

        // Verify keys are deactivated
        const getKeysResult = chain.callReadOnlyFn(
            'quantum-resistance-cryptographic',
            'get-quantum-keys',
            [types.principal(wallet1.address)],
            wallet1.address
        );

        assertEquals(getKeysResult.result.includes('is-active: false'), true);
    },
});

Clarinet.test({
    name: "Ensure that operations fail with deactivated keys",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        const messageHash = generateHash32();

        // Register and then deactivate keys
        let block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            ),
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'deactivate-quantum-keys',
                [],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 2);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, '(ok true)');
        assertEquals(block.height, 2);

        // Try to create signature with deactivated keys
        block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-signature',
                [
                    types.buff(messageHash),
                    types.buff(generateDilithiumSignature()),
                    types.buff(generateSPHINCSSignature())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u100)'); // ERR_UNAUTHORIZED
        assertEquals(block.height, 3);
    },
});

// Test Suite: Read-Only Function Verification
Clarinet.test({
    name: "Ensure that read-only functions return correct initial values",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;

        // Test initial contract stats
        const statsResult = chain.callReadOnlyFn(
            'quantum-resistance-cryptographic',
            'get-contract-stats',
            [],
            deployer.address
        );

        assertEquals(statsResult.result.includes('total-keys: u0'), true);
        assertEquals(statsResult.result.includes('threat-level: u0'), true);

        // Test non-existent key lookup
        const keysResult = chain.callReadOnlyFn(
            'quantum-resistance-cryptographic',
            'get-quantum-keys',
            [types.principal(wallet1.address)],
            deployer.address
        );

        assertEquals(keysResult.result, 'none');

        // Test signature verification for non-existent signature
        const isQuantumResistant = chain.callReadOnlyFn(
            'quantum-resistance-cryptographic',
            'is-quantum-resistant-signature',
            [types.principal(wallet1.address), types.buff(generateHash32())],
            deployer.address
        );

        assertEquals(isQuantumResistant.result, 'false');
    },
});

// Test Suite: Complex Integration Scenarios
Clarinet.test({
    name: "Ensure that complete quantum-resistant workflow functions correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;
        const wallet2 = accounts.get('wallet_2')!;
        const messageHash = generateHash32();
        const dataId = generateHash32();
        const chainId = generateHash32();

        // Complete workflow test
        let block = chain.mineBlock([
            // Register keys for multiple users
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet1.address
            ),
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'register-quantum-keys',
                [
                    types.buff(generateDilithiumKey()),
                    types.buff(generateSPHINCSKey()),
                    types.buff(generateKyberKey())
                ],
                wallet2.address
            ),
            // Update threat level
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'update-quantum-threat-level',
                [types.uint(3)],
                deployer.address
            ),
            // Create Merkle root
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-merkle-root',
                [
                    types.uint(1),
                    types.buff(generateHash32()),
                    types.uint(8),
                    types.uint(256)
                ],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 4);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, '(ok true)');
        assertEquals(block.receipts[2].result, '(ok u3)');
        assertEquals(block.receipts[3].result, '(ok u1)');
        assertEquals(block.height, 2);

        // Second block: Create signatures and store data
        block = chain.mineBlock([
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-signature',
                [
                    types.buff(messageHash),
                    types.buff(generateDilithiumSignature()),
                    types.buff(generateSPHINCSSignature())
                ],
                wallet1.address
            ),
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'store-encrypted-data',
                [
                    types.buff(dataId),
                    types.buff(generateKyberCiphertext()),
                    types.buff(generateHash32())
                ],
                wallet1.address
            ),
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'initialize-hash-chain',
                [
                    types.buff(chainId),
                    types.buff(generateHash32())
                ],
                wallet1.address
            )
        ]);

        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, '(ok true)');
        assertEquals(block.receipts[2].result.startsWith('(ok 0x'), true);
        assertEquals(block.height, 3);

        // Verify final contract state
        const finalStats = chain.callReadOnlyFn(
            'quantum-resistance-cryptographic',
            'get-contract-stats',
            [],
            deployer.address
        );

        assertEquals(finalStats.result.includes('total-keys: u2'), true);
        assertEquals(finalStats.result.includes('threat-level: u3'), true);
    },
});

// Test Suite: Edge Cases and Error Handling
Clarinet.test({
    name: "Ensure that contract handles edge cases and boundary conditions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get('deployer')!;
        const wallet1 = accounts.get('wallet_1')!;

        // Test zero values and boundary conditions
        let block = chain.mineBlock([
            // Try to create Merkle root with zero height (should fail)
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-merkle-root',
                [
                    types.uint(1),
                    types.buff(generateHash32()),
                    types.uint(0), // Invalid height
                    types.uint(1024)
                ],
                deployer.address
            ),
            // Try to create Merkle root with zero leaf count (should fail)
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'create-quantum-merkle-root',
                [
                    types.uint(2),
                    types.buff(generateHash32()),
                    types.uint(8),
                    types.uint(0) // Invalid leaf count
                ],
                deployer.address
            ),
            // Try to set threat level to maximum allowed value (should succeed)
            Tx.contractCall(
                'quantum-resistance-cryptographic',
                'update-quantum-threat-level',
                [types.uint(10)], // Maximum allowed
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].result, '(err u102)'); // ERR_INVALID_HASH
        assertEquals(block.receipts[1].result, '(err u102)'); // ERR_INVALID_HASH
        assertEquals(block.receipts[2].result, '(ok u10)');
        assertEquals(block.height, 2);
    },
});
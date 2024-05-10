import {account} from '@core/account'
import {GetCommitment, GetNullifier, UTXO} from '../utxo'
import { LeanIMT } from "@zk-kit/imt"
import {ProofInputs} from '@core/pool'

import { hashLeftRight, hash2, stringifyBigInts} from "maci-crypto"


describe('testUTXO', () => {
    test('commiting utxos', async () => {
        const acc = new account();
        const keypair = acc.genKeyPair();
        const privKey = keypair.privKey.asCircuitInputs()
        const pubKey = keypair.pubKey.asCircuitInputs()
        const tree = new LeanIMT(hashLeftRight)

        const proofInputs : ProofInputs = {
            publicValue: 100n,
            signalHash: hash2([100n, 200n]),
            inUnits: [],
            inpK: [],
            inBlinding: [],
            inLeafIndices: [],
            inputNullifier: [],
            merkleProofLength: 0,
            merkleProofIndices: [],
            merkleProofSiblings: [],
            outCommitment: [],
            outUnits: [],
            outPk_x: [],
            outPk_y: [],
            outBlinding: [],
        }
        const maxDepth = 20
        
        // Generate random UTXOs to populate the tree
       for (let i = 0; i < 100; i++) {
            const utxo: UTXO = {
                Pk: keypair.pubKey,
                amount: BigInt(Math.floor(Math.random() * 100)),
                blinding: BigInt(Math.floor(Math.random() * 100)),
                index: BigInt(tree.size),
            }
            const commitment = GetCommitment(utxo)
            tree.insert(commitment)
        }

        // Generate 2 input UTXOs
        proofInputs.inUnits = [100n, 200n]
        proofInputs.inpK = [privKey, privKey]
        proofInputs.inBlinding = [BigInt(Math.floor(Math.random() * 100)), BigInt(Math.floor(Math.random() * 100))]
        
        const utxos : UTXO[] = Array(2).fill(0).map((_, i) => {
            // Generate 1 input UTXO 
            const utxo: UTXO = {
                Pk: keypair.pubKey,
                amount: proofInputs.inUnits[i],
                blinding: proofInputs.inBlinding[i],
                index: BigInt(tree.size),
            }

            proofInputs.inLeafIndices.push(utxo.index)

            // get commitment
            const commitment = GetCommitment(utxo)
            console.log(" commitment: ", commitment)
            // insert into tree
            tree.insert(commitment)

            // get account to sign UTXO
            const sig = acc.signUTXO(utxo)
            console.log(" sig: ", sig)


            // get nullifier for UTXO 
            const nullifier = GetNullifier(utxo, sig)
            proofInputs.inputNullifier.push(nullifier)  

            expect(commitment > 0n).toBe(true);
            expect(nullifier > 0n).toBe(true);
            return utxo
        });

        proofInputs.merkleProofLength = BigInt(tree.depth)

        utxos.forEach((utxo, i) => {
            const {siblings: merkleProofSiblings, index} = tree.generateProof(Number(utxo.index))

            const merkleProofIndices: bigint[] = []
            for (let i = 0; i < maxDepth; i += 1) {
                merkleProofIndices.push((BigInt((index >> i) & 1)))

                if (merkleProofSiblings[i] === undefined) {
                    merkleProofSiblings[i] = BigInt(0)
                }
            }
            proofInputs.merkleProofIndices.push(merkleProofIndices)
            proofInputs.merkleProofSiblings.push(merkleProofSiblings)
        })

    
        // Generate 1 Output UTXO that has a value of the input UTXOS + publicval 
        const outputUtxo1: UTXO = {
            Pk: keypair.pubKey,
            amount: proofInputs.inUnits[0] + proofInputs.inUnits[1] + proofInputs.publicValue,
            blinding: BigInt(Math.floor(Math.random() * 100)),
            index: BigInt(tree.size),
        }
        proofInputs.outCommitment.push(GetCommitment(outputUtxo1))
        proofInputs.outBlinding.push(outputUtxo1.blinding) 

        // Generate 1 Output UTXO that has a value of 0 
        const outputUtxo2: UTXO = {
            Pk: keypair.pubKey,
            amount: 0n,
            blinding: BigInt(Math.floor(Math.random() * 100)),
            index: BigInt(tree.size),
        }

        proofInputs.outCommitment.push(GetCommitment(outputUtxo2))
        proofInputs.outBlinding.push(outputUtxo2.blinding)
        proofInputs.outUnits = [proofInputs.inUnits[0] + proofInputs.inUnits[1] + proofInputs.publicValue, 0n]

        proofInputs.outPk_x = [pubKey[0], pubKey[0]]
        proofInputs.outPk_y = [pubKey[1], pubKey[1]]

        console.log(stringifyBigInts(proofInputs))

    });
  });
  
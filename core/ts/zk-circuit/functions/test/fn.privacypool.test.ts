import type {
  TCommitment,
  Commitment,
  PrivacyKey
} from "@privacy-pool-v1/core-ts/account"
import {
  CreateCommitment,
  CreatePrivacyKey
} from "@privacy-pool-v1/core-ts/account"
import { FnPrivacyPool } from "@privacy-pool-v1/core-ts/zk-circuit"

import { expect, test, describe, beforeEach } from "@jest/globals"
import { LeanIMT } from "@zk-kit/lean-imt"
import { hashLeftRight } from "maci-crypto"

import {
  WASM_PATH,
  ZKEY_PATH,
  VKEY_PATH
} from "@privacy-pool-v1/core-ts/zk-circuit"
import fs from "fs"

function getTestDummyCommimtment(pK: PrivacyKey): Commitment {
  return CreateCommitment(pK, { amount: 0n })
}
function genTestCommitment(amount: bigint, pK: PrivacyKey): Commitment {
  return CreateCommitment(pK, { amount: amount })
}
function genTestCommitments(
  specs: { amount: bigint; pK: PrivacyKey }[]
): Commitment[] {
  return specs.map((spec) => genTestCommitment(spec.amount, spec.pK))
}

describe("Test Functions", () => {
  describe("Test MerkleProofFn", () => {
    let mt: LeanIMT
    beforeEach(() => {
      mt = new LeanIMT(hashLeftRight)
      // insert commitments
      for (let i = 1; i < 100; i++) {
        mt.insert(BigInt(i))
      }
    })

    test("Generate Merkle Proof of existing commitment", () => {
      expect(mt.root).not.toEqual(0n)
      expect(mt.size).toEqual(99)

      const proof = FnPrivacyPool.MerkleProofFn(55n, mt)
      expect(proof.Root).toEqual(mt.root)
      expect(proof.Depth).toEqual(7n)
      expect(proof.LeafIndex).toEqual(55n)
      expect(proof.Siblings.length).toEqual(32)
    })

    test("Generating merkle-proof of non-existing commitment should throw", () => {
      expect(() => {
        FnPrivacyPool.MerkleProofFn(120n, mt)
      }).toThrow()
    })
  })
  describe("Test CalcPublicValFn", () => {
    let pK: PrivacyKey
    beforeEach(() => {
      pK = CreatePrivacyKey()
    })

    test("Two dummy Inputs, 1 dummy Ouptut and 1 non-dummy Ouptut of size 100n", () => {
      const expected_public_val = 100n
      const inputs: TCommitment.RawT[] = genTestCommitments([
        { amount: 0n, pK: pK },
        { amount: 0n, pK: pK }
      ]).map((c) => c.raw)
      const outputs: TCommitment.RawT[] = genTestCommitments([
        { amount: 0n, pK: pK },
        { amount: 100n, pK: pK }
      ]).map((c) => c.raw)

      const public_val = FnPrivacyPool.CalcPublicValFn(inputs, outputs)
      expect(public_val).toEqual(expected_public_val)
    })
  })

  describe("Test GetInputsFn", () => {
    let mt: LeanIMT
    let pK: PrivacyKey

    const test_non_zero_amounts = [50n, 100n, 150n, 200n, 250n, 300n]
    let commitments: Commitment[]
    beforeEach(() => {
      mt = new LeanIMT(hashLeftRight)
      pK = CreatePrivacyKey()

      // generate commitments for non zero amounts
      // and insert into merkle tree
      commitments = test_non_zero_amounts.map((amount) => {
        const commitment = genTestCommitment(amount, pK)
        mt.insert(commitment.hash)
        commitment.index = BigInt(mt.size - 1)
        return commitment
      })
    })

    test("Input: (0, 50), Ouptut: (0, 100), PublicVal: 50", () => {
      const expected_public_val = 50n
      const non_zero_output = genTestCommitment(100n, pK)
      const inputs: TCommitment.RawT[] = [
        getTestDummyCommimtment(pK).raw,
        commitments[0].raw
      ]
      const outputs: TCommitment.RawT[] = [
        getTestDummyCommimtment(pK).raw,
        non_zero_output.raw
      ]

      const circuit_inputs = FnPrivacyPool.GetInputsFn(
        mt,
        inputs,
        outputs,
        100n
      )
      expect(circuit_inputs.publicVal).toEqual(expected_public_val)
      expect(circuit_inputs.signalHash).toEqual(100n)
      expect(circuit_inputs.inUnits).toEqual([0n, 50n])
      expect(circuit_inputs.inPk[1]).toEqual(pK.pubKey.asArray())
      expect(circuit_inputs.inputNullifier[1]).toEqual(commitments[0].nullifier)
      expect(circuit_inputs.outUnits).toEqual([0n, 100n])
      expect(circuit_inputs.outCommitment[1]).toEqual(non_zero_output.hash)
      expect(circuit_inputs.actualMerkleTreeDepth).toEqual(3n)
      expect(circuit_inputs.inLeafIndices).toEqual([0n, 0n])
    })
  })

  describe("Test ProveFn, VerifyFn & ParseFn", () => {
    let mt: LeanIMT
    let pK: PrivacyKey

    const test_non_zero_amounts = [50n, 100n, 150n, 200n, 250n, 300n]
    let commitments: Commitment[]

    const verifierKey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf-8"))

    beforeEach(async () => {
      mt = new LeanIMT(hashLeftRight)
      pK = CreatePrivacyKey()

      // generate commitments for non zero amounts
      // and insert into merkle tree
      commitments = test_non_zero_amounts.map((amount) => {
        const commitment = genTestCommitment(amount, pK)
        mt.insert(commitment.hash)
        commitment.index = BigInt(mt.size - 1)
        return commitment
      })
    })

    test("Input: (0, 50), Ouptut: (0, 100), PublicVal: 50", async () => {
      const non_zero_output = genTestCommitment(100n, pK)
      const inputs: TCommitment.RawT[] = [
        commitments[0].raw,
        getTestDummyCommimtment(pK).raw
      ]
      const outputs: TCommitment.RawT[] = [
        getTestDummyCommimtment(pK).raw,
        non_zero_output.raw
      ]

      const circuit_inputs = FnPrivacyPool.GetInputsFn(
        mt,
        inputs,
        outputs,
        100n
      )
      const out = await FnPrivacyPool.ProveFn(
        circuit_inputs,
        WASM_PATH,
        ZKEY_PATH
      )
      const ok = await FnPrivacyPool.VerifyFn(
        verifierKey,
        out.publicSignals,
        out.proof
      )
      expect(ok).toEqual(true)

      const parsed_proof = FnPrivacyPool.ParseFn(out.proof, out.publicSignals)
      expect(parsed_proof.publicSignals[0]).toEqual(mt.root)
    })

    //TO-DO: Add Negative Tests
  })
})

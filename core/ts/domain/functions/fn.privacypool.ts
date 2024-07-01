import type {
  TPrivacyPool,
  MerkleProofT,
} from "@privacy-pool-v1/core-ts/zk-circuit"
import { DummyMerkleProof } from "@privacy-pool-v1/core-ts/zk-circuit"
import { LeanIMT } from "@zk-kit/lean-imt"

import type { Commitment } from "@privacy-pool-v1/core-ts/domain"

export const MerkleTreeInclusionProof = (mt: LeanIMT, maxDepth = 32) => (leafindex: bigint) =>  FnPrivacyPool.merkleProofFn({ mt, maxDepth })(leafindex)
export namespace FnPrivacyPool {
  /**
   * computes merkle proof for a commitment
   * @param index leaf index of commitment
   * @param mt lean-incremental merkle tree from zk-kit
   * @param maxDepth maximum permitted depht of the merkle tree.
   */
  export const merkleProofFn =
    <
      argsT extends Partial<Readonly<TPrivacyPool.GetCircuitInArgsT>>,
      OuT extends Required<MerkleProofT>
    >(
      args: argsT
    ) =>
    (leafIndex: bigint | number): OuT => {
      if (!args.mt) {
        throw Error("Merkle tree is not defined")
      }
      try {
        const proof = args.mt.generateProof(Number(leafIndex))
        const depth = proof.siblings.length
        for (let i = 0; i < (args.maxDepth ? args.maxDepth : 32); i += 1) {
          if (proof.siblings[i] === undefined) {
            proof.siblings[i] = BigInt(0)
          }
        }
        return {
          Root: proof.root,
          Depth: BigInt(depth),
          index: proof.index ? BigInt(proof.index): (0n), 
          Siblings: proof.siblings
        } as OuT
      } catch (e) {
        throw Error(`Error generating merkle proof for leaf index ${leafIndex}, error: ${e}`)
      }
    }

  export const merkleProofsFn =
    <
      argsT extends Partial<Readonly<TPrivacyPool.GetCircuitInArgsT>>,
      OuT extends Required<MerkleProofT>
    >(
      args: argsT,
      merkleProof: (
        args: argsT
      ) => (idx: bigint | number) => OuT = merkleProofFn
    ) =>
    (
      dummyPredicate: (c: Commitment) => boolean = (c: Commitment) =>
        c.isDummy()
    ): OuT[] =>
      args.inputs
        ? args.inputs.map((input) =>
            dummyPredicate(input)
              ? (DummyMerkleProof as OuT)
              : (merkleProof(args)(input.index) as OuT)
          )
        : []
}

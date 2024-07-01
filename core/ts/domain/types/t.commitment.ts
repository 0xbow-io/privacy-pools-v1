import type { ICommitment } from "@privacy-pool-v1/core-ts/domain"

export namespace TCommitment {
  export type TupleT<N = bigint> = [N, N, N, N]
  export type CommitmentsT = ICommitment.CommitmentI[]
}

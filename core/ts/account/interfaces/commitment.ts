import type { Signature, Ciphertext } from "maci-crypto"
import type { PubKey } from "maci-domainobjs"

export namespace ICommitment {
  export interface CommitmentI<
    HashT = bigint,
    PkT = PubKey,
    NullifierT = bigint,
    SigT = Signature,
    CipherT = Ciphertext
  > {
    value: bigint
    salt: bigint
    pubKey: PkT
    index: bigint
    nonce: bigint
    isDummy: boolean
    isExhausted: boolean
    signature: SigT
    nullifier: NullifierT
    cipherText: CipherT
    secret_len: number
    hash(): HashT
    asArray(): bigint[]
  }
}

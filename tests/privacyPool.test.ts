import { account } from '@core/account';
import { GetCommitment, GetNullifier, CTX, caclSignalHash } from '@core/account';
import { LeanIMT } from '@zk-kit/lean-imt';
import { ProofInputs, generateProof } from '@core/pool';
import { FIELD_SIZE } from '@/store/variables';

import { hashLeftRight, hash2, stringifyBigInts } from 'maci-crypto';

import {
  WitnessTester,
  CircuitSignals,
  Circomkit,
  CircomkitConfig,
  CircuitConfig,
} from 'circomkit';

const fs = require('fs');

import { Hex } from 'viem';

const maxDepth = 32;

const privacyPoolConfig: CircuitConfig = {
  file: 'privacyPool',
  template: 'PrivacyPool',
  dir: 'main',
  pubs: ['publicVal', 'signalHash', 'merkleProofLength', 'inputNullifier', 'outCommitment'],
  params: [maxDepth, 2, 2],
};

const circomkitConf = {
  protocol: 'groth16',
  prime: 'bn128',
  version: '2.1.9',
  verbose: true,
};

const acc = new account();
const keypair = acc.genKeyPair();
const privKey = keypair.privKey.rawPrivKey;
const pubKey = keypair.pubKey.rawPubKey;
const tree = new LeanIMT(hashLeftRight);
const circomkit = new Circomkit(circomkitConf as CircomkitConfig);
const privacyPoolAddr = '0xb96BdDD5b2a794deA4Cb4020D8574A3a5c98250C' as Hex; // create2 address
const dummyAccount = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Hex;
const dummFeeAccount = '0xA9959D135F54F91b2f889be628E038cbc014Ec62' as Hex;

function generateProofInputs(
  units: bigint,
  feeVal: bigint,
  inputCTXs: CTX[],
): { proofInputs: ProofInputs; outputUtxos: CTX[]; expectedMerkleRoot: bigint } {
  let extVal = units - feeVal;
  let proofInputs: ProofInputs = {
    publicVal: extVal,
    signalHash: caclSignalHash(privacyPoolAddr, units, feeVal, dummyAccount, dummFeeAccount),
    inUnits: [],
    inPk: [],
    inSigR8: [],
    inSigS: [],
    inBlinding: [],
    inLeafIndices: [],
    inputNullifier: [],
    merkleProofLength: BigInt(0),
    merkleProofIndices: [],
    merkleProofSiblings: [],
    outCommitment: [],
    outUnits: [],
    outPk: [],
    outBlinding: [],
  };

  let expectedMerkleRoot = 0n;

  // prepare input data
  inputCTXs.forEach((utxo, i) => {
    proofInputs.inPk.push(utxo.Pk.rawPubKey);

    proofInputs.inBlinding.push(utxo.blinding);
    proofInputs.inUnits.push(utxo.amount);
    proofInputs.inLeafIndices.push(utxo.index);

    // get commitment
    const commitment = GetCommitment(utxo);

    // get account to sign CTX
    const sig = acc.signCTX(utxo);
    // attach sig components to proof inputs
    proofInputs.inSigR8.push([sig.R8[0] as bigint, sig.R8[1] as bigint]);
    proofInputs.inSigS.push(sig.S as bigint);

    // get nullifier for CTX
    proofInputs.inputNullifier.push(GetNullifier(utxo, sig));

    // prepare merkle proof for non-empty CTX
    if (utxo.amount === 0n) {
      proofInputs.merkleProofIndices.push(new Array(maxDepth).fill(0n));
      proofInputs.merkleProofSiblings.push(new Array(maxDepth).fill(0n));
    } else {
      const proof = tree.generateProof(Number(utxo.index));
      expectedMerkleRoot = proof.root;

      const merkleProofLength = proof.siblings.length;
      proofInputs.merkleProofLength = BigInt(merkleProofLength);

      const merkleProofIndices: bigint[] = [];
      const merkleProofSiblings = proof.siblings;

      for (let i = 0; i < maxDepth; i += 1) {
        merkleProofIndices.push(BigInt((proof.index >> i) & 1));

        if (merkleProofSiblings[i] === undefined) {
          merkleProofSiblings[i] = BigInt(0);
        }
      }
      proofInputs.merkleProofIndices.push(merkleProofIndices);
      proofInputs.merkleProofSiblings.push(merkleProofSiblings);
    }
  });

  let outputUtxos: CTX[] = [];

  let outputAmount = inputCTXs[0].amount + inputCTXs[1].amount + extVal;

  // Generate 1 Output CTX that has a value of the input CTXS + publicval
  outputUtxos[0] = {
    Pk: keypair.pubKey,
    amount: outputAmount,
    blinding: BigInt(Math.floor(Math.random() * 100)),
    index: BigInt(tree.size),
  };
  let outCommitment1 = GetCommitment(outputUtxos[0]);
  proofInputs.outCommitment.push(outCommitment1);
  proofInputs.outBlinding.push(outputUtxos[0].blinding);
  proofInputs.outPk.push(outputUtxos[0].Pk.rawPubKey);

  // Generate 1 Output CTX that has a value of 0
  outputUtxos[1] = {
    Pk: keypair.pubKey,
    amount: 0n,
    blinding: BigInt(Math.floor(Math.random() * 100)),
    index: 0n,
  };

  let outCommitment2 = GetCommitment(outputUtxos[1]);
  proofInputs.outCommitment.push(outCommitment2);
  proofInputs.outBlinding.push(outputUtxos[1].blinding);
  proofInputs.outPk.push(outputUtxos[1].Pk.rawPubKey);

  proofInputs.outUnits = [outputUtxos[0].amount, outputUtxos[1].amount];

  // insert output CTXs into the tree
  tree.insert(outCommitment1);
  tree.insert(outCommitment2);

  let cipherTexts = [];
  cipherTexts.push(acc.encryptCTX(outputUtxos[0]));
  cipherTexts.push(acc.encryptCTX(outputUtxos[1]));

  console.log('cipherTexts: ', cipherTexts);

  return { proofInputs, outputUtxos, expectedMerkleRoot };
}

function randomBlinder() {
  return BigInt(Math.floor(Math.random() * (Number(FIELD_SIZE) - 1)));
}

describe('PrivacyPool', () => {
  test('testing circuit', async () => {
    let circuit = await circomkit.WitnessTester('privacyPool', privacyPoolConfig);

    fs.writeFileSync('circomkit.json', JSON.stringify(circomkitConf));

    fs.writeFileSync(
      'circuits.json',
      JSON.stringify({
        privacyPool: privacyPoolConfig,
      }),
    );

    let extVals = [100n, 200n, -250n];
    let feeVals = [0n, 0n, 50n];

    let unspentCTX: CTX = {
      Pk: keypair.pubKey,
      amount: 0n,
      blinding: randomBlinder(),
      index: 0n,
    };

    extVals.forEach((extVal, i) => {
      const {
        proofInputs: proofInputs,
        outputUtxos: outputUtxos,
        expectedMerkleRoot: expectedMerkleRoot,
      } = generateProofInputs(extVal, feeVals[i], [
        unspentCTX,
        {
          Pk: keypair.pubKey,
          amount: 0n,
          blinding: randomBlinder(),
          index: 0n,
        },
      ]);

      unspentCTX = outputUtxos[0];

      console.log('proofInputs: ', stringifyBigInts(proofInputs));
      console.log('outputUtxos: ', outputUtxos);

      let fileName = `inputs/privacyPool/test_${i}.json`;
      console.log('writing to file: ', fileName);
      fs.writeFileSync(fileName, JSON.stringify(stringifyBigInts(proofInputs)));

      if (expectedMerkleRoot > 0n) {
        console.log('expectedRoot : ', expectedMerkleRoot);
        circuit.expectPass(
          {
            publicVal: proofInputs.publicVal,
            signalHash: proofInputs.signalHash,
            merkleProofLength: proofInputs.merkleProofLength,
            inputNullifier: proofInputs.inputNullifier,
            inUnits: proofInputs.inUnits,
            inPk: proofInputs.inPk,
            inBlinding: proofInputs.inBlinding,
            inSigR8: proofInputs.inSigR8,
            inSigS: proofInputs.inSigS,
            inLeafIndices: proofInputs.inLeafIndices,
            merkleProofIndices: proofInputs.merkleProofIndices,
            merkleProofSiblings: proofInputs.merkleProofSiblings,
            outCommitment: proofInputs.outCommitment,
            outUnits: proofInputs.outUnits,
            outPk: proofInputs.outPk,
            outBlinding: proofInputs.outBlinding,
          },
          {
            merkleRoot: expectedMerkleRoot,
          },
        );
      } else {
        circuit.expectPass({
          publicVal: proofInputs.publicVal,
          signalHash: proofInputs.signalHash,
          merkleProofLength: proofInputs.merkleProofLength,
          inputNullifier: proofInputs.inputNullifier,
          inUnits: proofInputs.inUnits,
          inPk: proofInputs.inPk,
          inBlinding: proofInputs.inBlinding,
          inSigR8: proofInputs.inSigR8,
          inSigS: proofInputs.inSigS,
          inLeafIndices: proofInputs.inLeafIndices,
          merkleProofIndices: proofInputs.merkleProofIndices,
          merkleProofSiblings: proofInputs.merkleProofSiblings,
          outCommitment: proofInputs.outCommitment,
          outUnits: proofInputs.outUnits,
          outPk: proofInputs.outPk,
          outBlinding: proofInputs.outBlinding,
        });
      }
      return;
    });
  });
});

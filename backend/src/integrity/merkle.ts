import { createHash } from 'node:crypto'

import type { IntegrityMerkleProof, IntegrityMerkleProofStep } from '../../../shared/integrityArtifacts'
import { hashArtifact } from './canonicalizeArtifact'

const sha256 = (...parts: Array<Uint8Array | Buffer>) => createHash('sha256')
  .update(Buffer.concat(parts.map(part => Buffer.from(part))))
  .digest()

const assertHash = (value: string) => {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Merkle leaves must contain lowercase SHA-256 digests.')
  return Buffer.from(value, 'hex')
}

const leafNode = (subjectHash: string) => sha256(Buffer.from([0]), assertHash(subjectHash))
const parentNode = (left: Buffer, right: Buffer) => sha256(Buffer.from([1]), left, right)

export const integrityMerkleLeafHash = (item: unknown | { contentHash: string }) => {
  if (item && typeof item === 'object' &&
      Object.keys(item as Record<string, unknown>).length === 1 &&
      typeof (item as { contentHash?: unknown }).contentHash === 'string') {
    const contentHash = (item as { contentHash: string }).contentHash.toLowerCase()
    assertHash(contentHash)
    return contentHash
  }
  return hashArtifact({ domain: 'votes-integrity-merkle-item/v1', value: item })
}

export const buildIntegrityMerkleTree = (items: Array<unknown | { contentHash: string }>) => {
  if (!items.length || items.length > 100_000) throw new Error('Merkle batches require 1 to 100,000 items.')
  const leafHashes = items.map(integrityMerkleLeafHash)
  const levels: Buffer[][] = [leafHashes.map(leafNode)]
  while (levels.at(-1)!.length > 1) {
    const current = levels.at(-1)!
    const next: Buffer[] = []
    for (let index = 0; index < current.length; index += 2) {
      next.push(parentNode(current[index]!, current[index + 1] ?? current[index]!))
    }
    levels.push(next)
  }
  return { rootHash: levels.at(-1)![0]!.toString('hex'), leafHashes, levels }
}

export const buildIntegrityMerkleProof = (
  leafHashes: string[],
  leafIndex: number,
): IntegrityMerkleProof => {
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= leafHashes.length) {
    throw new Error('Merkle leaf index is outside the manifest.')
  }
  const items = leafHashes.map(hash => ({ contentHash: hash }))
  const tree = buildIntegrityMerkleTree(items)
  const proof: IntegrityMerkleProofStep[] = []
  let index = leafIndex
  for (let levelIndex = 0; levelIndex < tree.levels.length - 1; levelIndex += 1) {
    const level = tree.levels[levelIndex]!
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1
    proof.push({
      position: index % 2 === 0 ? 'right' : 'left',
      hash: (level[siblingIndex] ?? level[index]!).toString('hex'),
    })
    index = Math.floor(index / 2)
  }
  return {
    algorithm: 'sha256-domain-v1',
    rootHash: tree.rootHash,
    leafHash: leafHashes[leafIndex]!,
    leafIndex,
    leafCount: leafHashes.length,
    proof,
  }
}

export const verifyIntegrityMerkleProof = (proof: IntegrityMerkleProof) => {
  let node = leafNode(proof.leafHash)
  for (const step of proof.proof) {
    const sibling = assertHash(step.hash)
    node = step.position === 'left' ? parentNode(sibling, node) : parentNode(node, sibling)
  }
  return node.toString('hex') === proof.rootHash
}

import { createHash } from 'node:crypto'

const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    )
  }
  return value
}

export const canonicalizeArtifact = (value: unknown) => JSON.stringify(normalize(value))

export const hashArtifact = (value: unknown) => createHash('sha256')
  .update(canonicalizeArtifact(value))
  .digest('hex')

export const hashArtifactCommitment = (input: {
  artifactType: string
  externalId: string
  schemaVersion: number
  subjectHash: string
  provenanceHash?: string
}) => hashArtifact({
  domain: input.provenanceHash ? 'votes-integrity-artifact/v2' : 'votes-integrity-artifact/v1',
  artifactType: input.artifactType,
  externalId: input.externalId,
  schemaVersion: input.schemaVersion,
  subjectHash: input.subjectHash,
  ...(input.provenanceHash ? { provenanceHash: input.provenanceHash } : {}),
})

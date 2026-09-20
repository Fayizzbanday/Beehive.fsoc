# Certified record v1

`beehive.record.v1` is a deliberately scoped canonicalization protocol, not a claim of full RFC 8785/JCS conformance. Changes to normalization require a new schema version and migration strategy; existing proofs must continue to use their original protocol.

## Certified fields

- `schemaVersion`, `publicId`
- `producerId`, `producerName`, `hiveIds`, `apiary`
- `origin`: region, latitude, longitude
- `honeyType`, `harvestDate`, `quantity`
- `qualityMeasurements`: moisture, HMF, diastase
- `lotInformation`, `extractionMethod`
- `certificateDigest`, `aiAssessmentDigest`
- `createdAt`

Notes, database row IDs, current proof status, review decisions and later hive telemetry are not certified batch fields. The public reference and registered source references are identifiers, not user secrets. Never include a password, device token, session token, signing key or original document in the QR or blockchain transaction.

## Normalization

1. Validate a strict schema; unknown keys reject.
2. Recursively sort object keys in UTF-16 lexicographic order.
3. Normalize strings to NFC, trim surrounding whitespace and collapse internal Unicode whitespace to one ASCII space. This intentionally treats formatting-only differences as equivalent.
4. Require explicit nulls. Reject undefined, unsupported objects and non-finite numbers.
5. Serialize finite numbers using ECMAScript JSON number representation; normalize negative zero to zero. Do not round coordinates, quantities or measurements.
6. Normalize `createdAt` to UTC with milliseconds. Validate harvest as an ISO calendar date.
7. Normalize and sort source hive references as a set. Duplicate references reject. Other array order remains significant.
8. Encode canonical text in UTF-8 and hash using SHA-256. Store the algorithm and payload version alongside the immutable canonical snapshot.

Assessments are canonicalized with the same generic JSON primitive and committed by digest. Uploaded certificate digests use SHA-256 of raw bytes, not a filename. Fields lock when the batch transitions from DRAFT to ANALYZED. Reanalysis cannot silently replace the assessment of an anchored record.

## Verification trust boundary

The configured RPC, chain ID and registry contract are the trust root. `getRecord(publicId)` binds the public reference to a fingerprint. Comparing only `verifyRecord(currentHash)` would be insufficient because it would not bind the hash to the requested public reference.

A verifier reads the current D1 payload, computes its fingerprint, checks its committed assessment, and compares against the contract value. Neither a stored D1 `status` nor its copied `record_hash` can grant authenticity. An unavailable chain is pending. A malformed changed record is tampered once a registration is confirmed. Verification events record the compared values.

The local demo can restore only the golden snapshot, and verifies that snapshot's hash against the current registry before writing it. The tamper/reset endpoint never updates the contract. Authority decisions append evidence; they do not rewrite the proof.

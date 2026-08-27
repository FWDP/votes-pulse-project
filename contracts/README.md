# PULSE report-integrity contract

The contract stores only opaque 32-byte report keys and SHA-256 content digests. Report content, identities, locations, and attachments remain in PULSE.

```bash
stellar contract build --manifest-path contracts/Cargo.toml
cargo test --manifest-path contracts/Cargo.toml
```

Deploy to Testnet with the same funded account as both the initial administrator and backend writer:

```bash
stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/report_integrity.wasm \
  --source-account pulse-integrity \
  --network testnet \
  -- --admin pulse-integrity --writer pulse-integrity
```

Copy the returned contract ID into `STELLAR_INTEGRITY_CONTRACT_ID`. The backend signer corresponding to the writer address signs every `anchor` invocation.

## Current Testnet v2 deployment

- Contract: `CCSUQUHI3U25WIZFDODQDC7T4MGKRVAIXVQVIITESQDFYAGMQ6J5KFFA`
- Wasm SHA-256: `e57084894fa1198afaf7bf3b6ca4ed12b3d5657d2abfe7ae0aed4d9be26babc4`
- Deployment transaction: `46170d73ad57b8b42589353b624f5796a61d14098c5c188664cc73d0d07e05ef`
- Backend initial anchor: `eb55180812e1255f64bd2eb56124183d0e119acb87f3ee93e8869246b61d1516`
- Backend chained attestation: `4733f951512d786d5fc25f18fc09ab347198ae99b15d2d02963acfaf7700b096`
- Backend TTL extension: `7324790dcc1a4628ce14c9bea2c3c276003325307afdc60ce9d82cc6b8f72898`

The earlier v1 Testnet contract remains at `CDKAQYQKVN3RVMWRO5MH6EMRRBOHBBOW37ZEFEPSY4WTBMDAKVYUNCTQ` for verification of its existing anchors.

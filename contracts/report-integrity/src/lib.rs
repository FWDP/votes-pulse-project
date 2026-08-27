#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
};

const RECORD_TTL_THRESHOLD: u32 = 17_280;
const RECORD_TTL_EXTEND_TO: u32 = 518_400;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Writer,
    Anchor(BytesN<32>, u32),
    Revision(BytesN<32>, u32),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Anchor {
    pub content_hash: BytesN<32>,
    pub ledger: u32,
    pub schema_version: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevisionAnchor {
    pub content_hash: BytesN<32>,
    pub kind: u32,
    pub ledger: u32,
    pub previous_hash: BytesN<32>,
    pub schema_version: u32,
}

#[contractevent(topics = ["pulse", "anchor"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnchorCreated {
    #[topic]
    pub report_key: BytesN<32>,
    #[topic]
    pub revision: u32,
    pub content_hash: BytesN<32>,
    pub ledger: u32,
    pub schema_version: u32,
}

#[contractevent(topics = ["pulse", "writer"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WriterRotated {
    pub new_writer: Address,
}

#[contractevent(topics = ["pulse", "revision"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevisionCreated {
    #[topic]
    pub report_key: BytesN<32>,
    #[topic]
    pub revision: u32,
    pub content_hash: BytesN<32>,
    pub kind: u32,
    pub previous_hash: BytesN<32>,
}

#[contractevent(topics = ["pulse", "admin"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminRotated {
    pub new_admin: Address,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum IntegrityError {
    InvalidRevision = 1,
    UnauthorizedWriter = 2,
    DuplicateAnchor = 3,
    InvalidPreviousHash = 4,
    MissingPreviousRevision = 5,
    UnauthorizedAdmin = 6,
}

fn require_writer(env: &Env, writer: &Address) -> Result<(), IntegrityError> {
    writer.require_auth();
    let configured: Address = env.storage().instance().get(&DataKey::Writer).unwrap();
    if writer != &configured {
        return Err(IntegrityError::UnauthorizedWriter);
    }
    Ok(())
}

fn require_admin(env: &Env, admin: &Address) -> Result<(), IntegrityError> {
    admin.require_auth();
    let configured: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    if admin != &configured {
        return Err(IntegrityError::UnauthorizedAdmin);
    }
    Ok(())
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(RECORD_TTL_THRESHOLD, RECORD_TTL_EXTEND_TO);
}

#[contract]
pub struct ReportIntegrityRegistry;

#[contractimpl]
impl ReportIntegrityRegistry {
    pub fn __constructor(env: Env, admin: Address, writer: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Writer, &writer);
    }

    pub fn anchor(
        env: Env,
        writer: Address,
        report_key: BytesN<32>,
        revision: u32,
        content_hash: BytesN<32>,
        schema_version: u32,
    ) -> Result<Anchor, IntegrityError> {
        if revision == 0 || schema_version == 0 {
            return Err(IntegrityError::InvalidRevision);
        }

        require_writer(&env, &writer)?;

        let key = DataKey::Anchor(report_key.clone(), revision);
        if env.storage().persistent().has(&key) {
            return Err(IntegrityError::DuplicateAnchor);
        }

        let anchor = Anchor {
            content_hash,
            ledger: env.ledger().sequence(),
            schema_version,
        };
        env.storage().persistent().set(&key, &anchor);
        env.storage().persistent().extend_ttl(
            &key,
            RECORD_TTL_THRESHOLD,
            RECORD_TTL_EXTEND_TO,
        );
        extend_instance_ttl(&env);
        AnchorCreated {
            report_key,
            revision,
            content_hash: anchor.content_hash.clone(),
            ledger: anchor.ledger,
            schema_version: anchor.schema_version,
        }
        .publish(&env);
        Ok(anchor)
    }

    pub fn anchor_revision(
        env: Env,
        writer: Address,
        report_key: BytesN<32>,
        revision: u32,
        content_hash: BytesN<32>,
        previous_hash: BytesN<32>,
        schema_version: u32,
        kind: u32,
    ) -> Result<RevisionAnchor, IntegrityError> {
        if revision < 2 || schema_version == 0 || kind > 1 {
            return Err(IntegrityError::InvalidRevision);
        }
        require_writer(&env, &writer)?;

        let key = DataKey::Revision(report_key.clone(), revision);
        if env.storage().persistent().has(&key) {
            return Err(IntegrityError::DuplicateAnchor);
        }
        let expected_previous = if revision == 2 {
            let previous: Option<Anchor> = env
                .storage()
                .persistent()
                .get(&DataKey::Anchor(report_key.clone(), 1));
            previous
                .map(|anchor| anchor.content_hash)
                .ok_or(IntegrityError::MissingPreviousRevision)?
        } else {
            let previous: Option<RevisionAnchor> = env
                .storage()
                .persistent()
                .get(&DataKey::Revision(report_key.clone(), revision - 1));
            previous
                .map(|anchor| anchor.content_hash)
                .ok_or(IntegrityError::MissingPreviousRevision)?
        };
        if previous_hash != expected_previous {
            return Err(IntegrityError::InvalidPreviousHash);
        }

        let anchor = RevisionAnchor {
            content_hash,
            kind,
            ledger: env.ledger().sequence(),
            previous_hash,
            schema_version,
        };
        env.storage().persistent().set(&key, &anchor);
        env.storage().persistent().extend_ttl(
            &key,
            RECORD_TTL_THRESHOLD,
            RECORD_TTL_EXTEND_TO,
        );
        extend_instance_ttl(&env);
        RevisionCreated {
            report_key,
            revision,
            content_hash: anchor.content_hash.clone(),
            kind,
            previous_hash: anchor.previous_hash.clone(),
        }
        .publish(&env);
        Ok(anchor)
    }

    pub fn get_anchor(env: Env, report_key: BytesN<32>, revision: u32) -> Option<Anchor> {
        let key = DataKey::Anchor(report_key, revision);
        let anchor = env.storage().persistent().get(&key);
        if anchor.is_some() {
            env.storage().persistent().extend_ttl(
                &key,
                RECORD_TTL_THRESHOLD,
                RECORD_TTL_EXTEND_TO,
            );
        }
        anchor
    }

    pub fn get_revision(
        env: Env,
        report_key: BytesN<32>,
        revision: u32,
    ) -> Option<RevisionAnchor> {
        if revision < 2 {
            return None;
        }
        let key = DataKey::Revision(report_key, revision);
        let anchor = env.storage().persistent().get(&key);
        if anchor.is_some() {
            env.storage().persistent().extend_ttl(
                &key,
                RECORD_TTL_THRESHOLD,
                RECORD_TTL_EXTEND_TO,
            );
        }
        anchor
    }

    pub fn touch_anchor(
        env: Env,
        writer: Address,
        report_key: BytesN<32>,
        revision: u32,
    ) -> Result<bool, IntegrityError> {
        require_writer(&env, &writer)?;
        let key = if revision == 1 {
            DataKey::Anchor(report_key, revision)
        } else {
            DataKey::Revision(report_key, revision)
        };
        if !env.storage().persistent().has(&key) {
            return Err(IntegrityError::MissingPreviousRevision);
        }
        env.storage().persistent().extend_ttl(
            &key,
            RECORD_TTL_THRESHOLD,
            RECORD_TTL_EXTEND_TO,
        );
        extend_instance_ttl(&env);
        Ok(true)
    }

    pub fn rotate_writer(
        env: Env,
        admin: Address,
        new_writer: Address,
    ) -> Result<(), IntegrityError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Writer, &new_writer);
        WriterRotated { new_writer }.publish(&env);
        Ok(())
    }

    pub fn rotate_admin(
        env: Env,
        admin: Address,
        new_admin: Address,
    ) -> Result<(), IntegrityError> {
        require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        AdminRotated { new_admin }.publish(&env);
        Ok(())
    }

    pub fn upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), IntegrityError> {
        require_admin(&env, &admin)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    pub fn writer(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Writer).unwrap()
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

#[cfg(test)]
mod test;

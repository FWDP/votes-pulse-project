use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

fn bytes(env: &Env, value: u8) -> BytesN<32> {
    BytesN::from_array(env, &[value; 32])
}

#[test]
fn anchors_and_reads_an_immutable_digest() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let contract_id = env.register(ReportIntegrityRegistry, (&admin, &writer));
    let client = ReportIntegrityRegistryClient::new(&env, &contract_id);

    let anchor = client.anchor(&writer, &bytes(&env, 1), &1, &bytes(&env, 2), &1);
    assert_eq!(anchor.content_hash, bytes(&env, 2));
    assert_eq!(client.get_anchor(&bytes(&env, 1), &1), Some(anchor));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn rejects_duplicate_revision() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let contract_id = env.register(ReportIntegrityRegistry, (&admin, &writer));
    let client = ReportIntegrityRegistryClient::new(&env, &contract_id);

    client.anchor(&writer, &bytes(&env, 1), &1, &bytes(&env, 2), &1);
    client.anchor(&writer, &bytes(&env, 1), &1, &bytes(&env, 3), &1);
}

#[test]
fn rotates_the_writer_with_admin_authorization() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let next_writer = Address::generate(&env);
    let contract_id = env.register(ReportIntegrityRegistry, (&admin, &writer));
    let client = ReportIntegrityRegistryClient::new(&env, &contract_id);

    client.rotate_writer(&admin, &next_writer);
    assert_eq!(client.writer(), next_writer);
}

#[test]
fn chains_review_attestations_to_the_previous_digest() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let contract_id = env.register(ReportIntegrityRegistry, (&admin, &writer));
    let client = ReportIntegrityRegistryClient::new(&env, &contract_id);
    let report_key = bytes(&env, 1);
    let first_hash = bytes(&env, 2);

    client.anchor(&writer, &report_key, &1, &first_hash, &1);
    let second = client.anchor_revision(
        &writer,
        &report_key,
        &2,
        &bytes(&env, 3),
        &first_hash,
        &1,
        &1,
    );

    assert_eq!(second.previous_hash, first_hash);
    assert_eq!(second.kind, 1);
    assert_eq!(client.get_revision(&report_key, &2), Some(second));
    assert!(client.touch_anchor(&writer, &report_key, &2));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_a_broken_revision_chain() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let contract_id = env.register(ReportIntegrityRegistry, (&admin, &writer));
    let client = ReportIntegrityRegistryClient::new(&env, &contract_id);
    let report_key = bytes(&env, 1);

    client.anchor(&writer, &report_key, &1, &bytes(&env, 2), &1);
    client.anchor_revision(
        &writer,
        &report_key,
        &2,
        &bytes(&env, 3),
        &bytes(&env, 9),
        &1,
        &1,
    );
}

#[test]
fn rotates_the_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let next_admin = Address::generate(&env);
    let contract_id = env.register(ReportIntegrityRegistry, (&admin, &writer));
    let client = ReportIntegrityRegistryClient::new(&env, &contract_id);

    client.rotate_admin(&admin, &next_admin);
    assert_eq!(client.admin(), next_admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn rejects_an_unconfigured_writer() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let attacker = Address::generate(&env);
    let contract_id = env.register(ReportIntegrityRegistry, (&admin, &writer));
    let client = ReportIntegrityRegistryClient::new(&env, &contract_id);

    client.anchor(&attacker, &bytes(&env, 1), &1, &bytes(&env, 2), &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn rejects_an_unconfigured_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let attacker = Address::generate(&env);
    let contract_id = env.register(ReportIntegrityRegistry, (&admin, &writer));
    let client = ReportIntegrityRegistryClient::new(&env, &contract_id);

    client.rotate_writer(&attacker, &attacker);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_zero_schema_versions() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let writer = Address::generate(&env);
    let contract_id = env.register(ReportIntegrityRegistry, (&admin, &writer));
    let client = ReportIntegrityRegistryClient::new(&env, &contract_id);

    client.anchor(&writer, &bytes(&env, 1), &1, &bytes(&env, 2), &0);
}

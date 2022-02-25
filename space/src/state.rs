use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use std::mem::size_of;

pub const NEIGHBORHOOD_SIZE: usize = 200;
pub const MARKETPLACE_FEE: f64 = 0.01;
pub const VOUCHER_RECEIVE_LIMIT: u64 = 100;
pub const VOUCHER_PRICE_CONSTANT: f64 = 0.01059;
pub const VOUCHER_PRICE_TOLERANCE: u64 = 100;

pub const EXTEND_TOKEN_MINT: &str = "PLACEHOLDER";
pub const NEIGHBORHOOD_METADATA_SEED: &[u8] = b"neighborhood_metadata";
pub const NEIGHBORHOOD_LIST_SEED: &[u8] = b"neighborhood_list";
pub const VOUCHER_MINT_SEED: &[u8] = b"voucher_mint";
pub const VOUCHER_SINK_SEED: &[u8] = b"voucher_sink";
pub const SPACE_METADATA_SEED: &[u8] = b"space_metadata";
pub const SELL_DELEGATE_SEED: &[u8] = b"sell_delegate";

pub const BASE_RESERVE: usize = 2048;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Base {
    pub neighborhood_count: u64,
    pub authority: Pubkey,
    pub authority_privileges: bool,
}
impl Base {
    pub const LEN: usize = size_of::<u64>() + size_of::<Pubkey>() + size_of::<bool>();
}

pub const NEIGHBORHOOD_LIST_RESERVE: usize = 10240;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct NeighborhoodList {
    pub bump: u8,
    pub neighborhoods_x: Vec<i64>,
    pub neighborhoods_y: Vec<i64>,
}

pub const NEIGHBORHOOD_METADATA_RESERVE: usize = 512;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct NeighborhoodMetadata {
    pub bump: u8,
    pub creator: Pubkey,
    pub candymachine_config: Pubkey,
    pub candymachine_account: Pubkey,
    pub neighborhood_name: [u8; 64],
    pub voucher_live_date: u64,
    pub voucher_receive_limit: u64,
    pub voucher_price_coefficient: u64, // coef * 1e9
}

impl NeighborhoodMetadata {
    pub const LEN: usize = size_of::<u8>() + size_of::<Pubkey>() + size_of::<Pubkey>() + size_of::<Pubkey>() + 64*size_of::<u8>();
}

pub const SPACE_METADATA_RESERVE: usize = 128;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct SpaceMetadata {
    pub bump: u8,
    pub mint: Pubkey,
    pub price: u64,
    pub space_x: i64,
    pub space_y: i64,
}

impl SpaceMetadata {
    pub const LEN: usize =
        size_of::<u8>() + size_of::<Pubkey>() + size_of::<u64>() + size_of::<i64>() + size_of::<i64>();
}
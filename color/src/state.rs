use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use std::mem::size_of;

pub const INACTIVITY_THRESHOLD_OWNER: usize = 3600*24*14;
pub const INACTIVITY_THRESHOLD_ARBITRARY: usize = 0;
pub const ARBITRARY_CHANGER_FEE: u64 = 1000;
pub const NEIGHBORHOOD_SIZE: usize = 200;
pub const MARKETPLACE_FEE: f64 = 0.01;
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

pub const MAX_NEIGHBORHOODS: usize = 8;
pub const NEIGHBORHOOD_LIST_RESERVE: usize = 10240;
// pub const MAX_NEIGHBORHOODS: usize = 0;
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

// begin color program state
pub const SPACE_PID: &str = "XSPCZghPXkWTWpvrfQ34Szpx3rwmUjsxebRFf5ckbMD";
pub const NEIGHBORHOOD_FRAME_BASE_SEED: &[u8] = b"neighborhood_frame_base";
pub const NEIGHBORHOOD_FRAME_POINTER_SEED: &[u8] = b"neighborhood_frame_pointer";
pub const MAX_FRAMES: u64 = 6;

pub const NEIGHBORHOOD_FRAME_BASE_RESERVE: usize = 256;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct NeighborhoodFrameBase {
    pub bump: u8,
    pub length: u64,
    pub time_cluster_account: Pubkey,
}

impl NeighborhoodFrameBase {
    pub const LEN: usize = size_of::<u8>() + size_of::<u64>();
}

pub const NEIGHBORHOOD_FRAME_POINTER_RESERVE: usize = 128;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct NeighborhoodFramePointer {
    pub bump: u8,
    pub framekey: Pubkey,
}

impl NeighborhoodFramePointer {
    pub const LEN: usize = size_of::<u8>() + size_of::<Pubkey>();
}

pub const FRAME_RESERVE: usize = 131072;
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct Frame {
    pub colors: [[u8; 3]; NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE],
    pub neighborhood_x: i64,
    pub neighborhood_y: i64,
    pub initialized: bool,
}
impl Frame {
    pub const LEN: usize = 3 * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE + size_of::<i64>() + size_of::<i64>() + size_of::<bool>();
}

pub const TIME_CLUSTER_RESERVE: usize = 400000;
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct TimeCluster {
    pub timestamps: [u64; NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE],
    pub neighborhood_x: i64,
    pub neighborhood_y: i64,
    pub initialized: bool,
}
impl TimeCluster {
    pub const LEN: usize = size_of::<u64>() * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE + size_of::<i64>() + size_of::<i64>();
}

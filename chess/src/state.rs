use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use std::mem::size_of;

pub const NEIGHBORHOOD_SIZE: usize = 200;

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

// begin color program state
pub const NEIGHBORHOOD_BOARD_BASE_SEED: &[u8] = b"neighborhood_board_base";
pub const NEIGHBORHOOD_BOARD_POINTER_SEED: &[u8] = b"neighborhood_board_pointer";
pub const MAX_BOARDS: u64 = 6;

pub const NEIGHBORHOOD_BOARD_BASE_RESERVE: usize = 256;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct NeighborhoodBoardBase {
    pub bump: u8,
    pub length: u64,
}

impl NeighborhoodBoardBase {
    pub const LEN: usize = size_of::<u8>() + size_of::<u64>();
}

pub const NEIGHBORHOOD_BOARD_POINTER_RESERVE: usize = 128;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct NeighborhoodBoardPointer {
    pub bump: u8,
    pub boardkey: Pubkey,
}

impl NeighborhoodBoardPointer {
    pub const LEN: usize = size_of::<u8>() + size_of::<Pubkey>();
}

pub enum Phase {
    Initialized,
    PickSide,
    WhiteTurn,
    BlackTurn,
    WhiteWin,
    BlackWin,
    Draw
}

pub const BOARD_RESERVE: usize = 130000;
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct Board {
    pub votes: [[u8; 3]; NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE],
    pub game_arr: [u8; 73],
    pub white_whitelist: [[u8; 2]; 10],
    pub black_whitelist: [[u8; 2]; 10],
    pub max_white_player: u16,
    pub max_black_player: u16,
    pub min_white_vote: u16,
    pub min_black_vote: u16,
    pub num_white_vote: u16,
    pub num_black_vote: u16,
    pub max_timeout_join: u64,
    pub max_timeout_vote: u64,
    pub phase_start: u64,
    pub phase: u8,
    pub step: u8,
    
}

impl Board {
    pub const LEN: usize = 3 * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE + 73 + 20 * 2 + 2 * 8 + 8 * 3 + 1 + 1;
}
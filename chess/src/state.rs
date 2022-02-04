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

pub const NEIGHBORHOOD_BOARD_BASE_RESERVE: usize = 256;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct NeighborhoodBoardBase {
    pub bump: u8,
    pub boardkey: Pubkey,
}

impl NeighborhoodBoardBase {
    pub const LEN: usize = size_of::<u8>() + size_of::<Pubkey>();
}

pub enum Phase {
    Initialized,
    PickSide,
    WhiteTurn,
    BlackTurn,
    WhiteWin,
    BlackWin,
    Draw,
    Resign,
}

pub enum Whitelist {
    Neighborhood,
    Pubkey,
}

pub enum Side {
    Undefined,
    White,
    Black,
}

pub const BOARD_RESERVE: usize = 130000;
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Board {
    pub votes: [u8; 3 * 200 * 200],
    pub game_arr: [u8; 73],
    pub white_pubkey: Pubkey,
    pub black_pubkey: Pubkey,
    pub white_type: u8,
    pub black_type: u8,
    // pub white_whitelist: [[u8; 2]; 10],
    // pub black_whitelist: [[u8; 2]; 10],
    // pub max_white_player: u16,
    // pub max_black_player: u16,
    pub min_white_vote: u16,
    pub min_black_vote: u16,
    pub num_white_vote: u16,
    pub num_black_vote: u16,
    pub max_timeout_join: u64,
    pub max_timeout_vote: u64,
    pub phase_start: u64,
    pub phase: u8,
    pub num_move: u16,
}

impl Board {
    pub const LEN: usize = 3 * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE + 73 + 2 * 32 + 2 * 4 + 4 * 4 + 3 * 8 + 1 + 2;
}
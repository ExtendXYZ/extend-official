use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use std::mem::size_of;

pub const NEIGHBORHOOD_SPACES: usize = 200 * 200;
pub const RESTRICTED_SPACES: usize = 32 * 32;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub enum Side {
    Undefined,
    White,
    Black,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub enum Phase {
    Registering,
    Active,
    Inactive,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub enum Result {
    BlackWin,
    Draw,
    WhiteWin,
}

// Castling and en passant validated in ix handler
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Move {
    pub from: u8,
    pub to: u8,
}

impl Move {
    pub fn none() -> Move {
        Move { from: 255, to: 255 }
    }
}

pub const MIN_QUORUM_REGISTER: u16 = 0;
pub const MIN_QUORUM_MOVE: u16 = 0;

pub const MAX_QUORUM_REGISTER: u16 = 40000;
pub const MAX_QUORUM_MOVE: u16 = 40000;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub struct PlayerParams {
    pub has_pk: bool,
    pub player_pk: Pubkey,     // used if has_pk
    pub quorum_register: u16,  // used if !has_pk
    pub quorum_move: u16,      // used if !has_pk
}

impl PlayerParams {
    pub fn none() -> PlayerParams { PlayerParams {
        has_pk: false,
        player_pk: Pubkey::new_from_array([0; 32]),
        quorum_register: 0,
        quorum_move: 0,
    }}
}

pub const BOARD_SEED: &[u8] = b"chessplaya";
pub const GAME_ARR_LEN: usize = 73;

pub const MIN_INTERVAL_REGISTER: u64 = 60;
pub const MIN_INTERVAL_MOVE: u64 = 10;
pub const MIN_INTERVAL_KEEP: u64 = 60;

pub const MAX_INTERVAL_REGISTER: u64 = 60 * 60 * 24;
pub const MAX_INTERVAL_MOVE: u64 = 60 * 60;
pub const MAX_INTERVAL_KEEP: u64 = 60 * 60 * 24 * 7;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Board {
    pub owner: Pubkey,
    pub nx: i64,
    pub ny: i64,
    pub game_arr: Vec<u8>,  // board representation in legal_chess
    pub player_white: PlayerParams,
    pub player_black: PlayerParams,
    pub interval_register: u64,
    pub interval_move: u64,
    pub interval_keep: u64,
    pub next_deadline: u64,  // set using interval_register or interval_move
    pub phase: Phase,
}

// Then NEIGHBORHOOD_SPACES * <Side>
// Then NEIGHBORHOOD_SPACES * <Move>

impl Board {
    pub const LEN: usize =
        size_of::<Pubkey>() +
        size_of::<i64>() +
        size_of::<i64>() +
        size_of::<u32>() + size_of::<u8>() * GAME_ARR_LEN +
        size_of::<PlayerParams>() * 2 +
        size_of::<u64>() * 4 +
        size_of::<Phase>();

    pub fn neighborhood_board(owner: Pubkey, nx: i64, ny: i64) -> Board {
        Board {
            owner,
            nx,
            ny,
            game_arr: vec![0; GAME_ARR_LEN],
            player_white: PlayerParams::none(),
            player_black: PlayerParams::none(),
            interval_register: 0,
            interval_move: 0,
            interval_keep: 0,
            next_deadline: 0,
            phase: Phase::Inactive,
        }
    }
}
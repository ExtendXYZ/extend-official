use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use std::mem::size_of;

pub const NEIGHBORHOOD_SPACES: usize = 200 * 200;

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
    Finished,
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

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct PlayerParams {
    pub has_pk: bool,
    pub player_pk: Pubkey,      // used if has_pk
    pub quorum_register: u16,   // used if !has_pk
    pub quorum_move: u16,       // used if !has_pk
}

pub const BOARD_SEED: &[u8] = b"chessplaya";
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Board {
    pub sides: Vec<Side>,
    pub votes: Vec<Move>,
    pub game_arr: Vec<u8>,  // board representation in legal_chess
    pub player_white: PlayerParams,
    pub player_black: PlayerParams,
    pub interval_register: u64,
    pub interval_move: u64,
    pub phase: Phase,
}

impl Board {
    pub const LEN: usize =
        size_of::<usize>() * NEIGHBORHOOD_SPACES +
        size_of::<Move>() * NEIGHBORHOOD_SPACES +
        size_of::<u8>() * 73 +
        size_of::<PlayerParams>() * 2 +
        size_of::<u64>() * 2 +
        size_of::<Phase>();
}
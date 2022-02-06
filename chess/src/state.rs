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

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
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

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Board {
    pub owner: Pubkey,
    pub sides: Vec<Side>,
    pub votes: Vec<Move>,
    pub game_arr: Vec<u8>,  // board representation in legal_chess
    pub player_white: PlayerParams,
    pub player_black: PlayerParams,
    pub interval_register: u64,
    pub interval_move: u64,
    pub interval_keep: u64,
    pub next_deadline: u64,  // set using interval_register or interval_move
    pub phase: Phase,
}

impl Board {
    pub const LEN: usize =
        size_of::<Pubkey>() +
        size_of::<u32>() + size_of::<Side>() * NEIGHBORHOOD_SPACES +
        size_of::<u32>() + size_of::<Move>() * NEIGHBORHOOD_SPACES +
        size_of::<u32>() + size_of::<u8>() * GAME_ARR_LEN +
        size_of::<PlayerParams>() * 2 +
        size_of::<u64>() * 4 +
        size_of::<Phase>();

    pub fn neighborhood_board(owner: Pubkey) -> Board {
        Board {
            owner,
            sides: vec![Side::Undefined; NEIGHBORHOOD_SPACES],
            votes: vec![Move::none(); NEIGHBORHOOD_SPACES],
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
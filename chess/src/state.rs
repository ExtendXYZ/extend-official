use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use std::mem::size_of;
use legal_chess::{
    chessmove::ChessMove,
    pieces::piece::PromotionPiece,
};

pub const NEIGHBORHOOD_SIDE: usize = 200;
pub const NEIGHBORHOOD_SPACES: usize = NEIGHBORHOOD_SIDE * NEIGHBORHOOD_SIDE;
pub const RESTRICTED_SPACES: usize = 8 * 8;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub enum Side {
    Undefined = 0,
    White = 1,
    Black = 2,
}

impl From<u8> for Side {
    fn from(v: u8) -> Self {
        return match v {
            0x0 => Side::Undefined,
            0x1 => Side::Black,
            0x2 => Side::Black,
            _ => Side::Undefined,
        };
    }
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub enum Phase {
    Registering = 0,
    Active = 1,
    Inactive = 2,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub enum Result {
    BlackWin = 0,
    Draw = 1,
    WhiteWin = 2,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub enum Promotion {
    NA = 0,
    Queen = 1,
    Rook = 2,
    Knight = 3,
    Bishop = 4,
}

// a1 = 0, a5 = 5
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Move {
    pub from: u8,
    pub to: u8,
    pub promotion: Promotion,
}

impl Move {
    pub fn none() -> Move {
        Move { from: 255, to: 255, promotion: Promotion::NA}
    }
    pub fn from_pair(file_rank: (u8, u8)) -> u8 {
        (file_rank.1-1)*8 + file_rank.0
    }
    pub fn to_pair(index: u8) -> (u8, u8) {
        (index%8 + 1, index/8 + 1)
    }
    pub fn from(chess_move: ChessMove) -> Move {
        Move {
            from: Move::from_pair(chess_move.from),
            to: Move::from_pair(chess_move.to),
            promotion: match &chess_move.promotion {
                None => Promotion::NA,
                Some(p) => match p {
                    PromotionPiece::Rook => Promotion::Rook,
                    PromotionPiece::Knight => Promotion::Knight,
                    PromotionPiece::Bishop => Promotion::Bishop,
                    PromotionPiece::Queen => Promotion::Queen,
                },
            },
        }
    }
    pub fn convert(&self) -> ChessMove {
        ChessMove {
            from: Move::to_pair(self.from),
            to: Move::to_pair(self.to),
            promotion: match &self.promotion {
                Promotion::NA => None,
                Promotion::Rook => Some(PromotionPiece::Rook),
                Promotion::Knight => Some(PromotionPiece::Knight),
                Promotion::Bishop => Some(PromotionPiece::Bishop),
                Promotion::Queen => Some(PromotionPiece::Queen),
            },
        }
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
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use std::mem::size_of;
use legal_chess::{
    chessmove::ChessMove,
    color::Color,
    pieces::piece::PromotionPiece,
};

pub const NEIGHBORHOOD_SIDE: usize = 200;
pub const NEIGHBORHOOD_SPACES: usize = NEIGHBORHOOD_SIDE * NEIGHBORHOOD_SIDE;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub enum Side {
    Undefined = 0,
    White = 1,
    Black = 2,
}

impl From<u8> for Side {
    fn from(v: u8) -> Self {
        match v {
            0x0 => Side::Undefined,
            0x1 => Side::White,
            0x2 => Side::Black,
            _ => Side::Undefined,
        }
    }
}

impl From<Color> for Side {
    fn from(v: Color) -> Self {
        match v {
            Color::WHITE => Side::White,
            Color::BLACK => Side::Black,
        }
    }
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Space {
    pub x: i64,
    pub y: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub struct Reg {
    pub idx: u8,
    pub side: Side,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub enum Phase {
    Registering = 0,
    Active = 1,
    Inactive = 2,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub enum Result {
    None = 0,
    Draw = 1,
    WhiteWin = 2,
    BlackWin = 3,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Eq, Debug, Clone, Copy)]
pub enum Promotion {
    None = 0,
    Queen = 1,
    Rook = 2,
    Knight = 3,
    Bishop = 4,
}

// a1 = 0, a5 = 5
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Eq, Debug, Clone, Copy)]
pub struct Move {
    pub from: u8,
    pub to: u8,
    pub promotion: Promotion,
}

pub const RESIGN: u8 = 255;
pub const RESIGN_MOVE: Move = Move { from: RESIGN, to: RESIGN, promotion: Promotion::None };

impl Move {
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
                None => Promotion::None,
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
                Promotion::None => None,
                Promotion::Rook => Some(PromotionPiece::Rook),
                Promotion::Knight => Some(PromotionPiece::Knight),
                Promotion::Bishop => Some(PromotionPiece::Bishop),
                Promotion::Queen => Some(PromotionPiece::Queen),
            },
        }
    }
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub struct Vote {
    pub idx: u8,
    pub ply: u8,
    pub mv: Move,
}

impl Vote {
    pub fn empty() -> Vote {
        Vote {idx: 0, ply: 0, mv: Move {from: 0, to: 0, promotion: Promotion::None}}
    }
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub struct VoteCount {
    pub vote: Vote,
    pub count: u16,
}

impl VoteCount {
    pub fn empty() -> VoteCount {
        VoteCount {vote: Vote::empty(), count: 0}
    }
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub struct PlayerParams {
    pub has_pk: bool,
    pub player_pk: Pubkey,     // used if has_pk
}

impl PlayerParams {
    pub fn none() -> PlayerParams { PlayerParams {
        has_pk: false,
        player_pk: Pubkey::new_from_array([0; 32]),
    }}
}

pub const GAME_ARR_LEN: usize = 73;
pub const VOTE_ARR_LEN: usize = 256;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Board {
    pub owner: Pubkey,
    pub nx: i64,
    pub ny: i64,
    pub idx: u8,  // increments for every game, used to ensure registration validity
    pub game_arr: Vec<u8>,  // board representation in legal_chess
    pub player_white: PlayerParams,
    pub player_black: PlayerParams,
    pub reg_white: u16,
    pub reg_black: u16,
    pub register_deadline: u64,
    pub move_interval: u64,
    pub move_deadline: u64,  // set using move_interval
    pub phase: Phase,
    pub result: Result,
}

// Then Vec<VoteCount> of size VOTE_ARR_LEN
pub const TALLY_OFFSET: usize = size_of::<usize>() + size_of::<VoteCount>() * VOTE_ARR_LEN;
// Then NEIGHBORHOOD_SPACES * <Reg>, should be a ZeroCopy
pub const REG_OFFSET: usize = NEIGHBORHOOD_SPACES * size_of::<Reg>();
// Then NEIGHBORHOOD_SPACES * <Vote>, should be a ZeroCopy
pub const VOTE_OFFSET: usize = NEIGHBORHOOD_SPACES * size_of::<Vote>();

pub const TALLY_START: usize = Board::LEN;
pub const TALLY_VOTE_START: usize = TALLY_START + size_of::<usize>();
pub const REG_START: usize = Board::LEN + TALLY_OFFSET;
pub const VOTE_START: usize = Board::LEN + TALLY_OFFSET + REG_OFFSET;

impl Board {
    // 32 + 8 * 2 + 1 + (4 + 73) + (1 + 32) * 2 + 2 * 2 + 8 * 3 + 1 + 1
    pub const LEN: usize =
        size_of::<Pubkey>() +
        size_of::<i64>() * 2 +
        size_of::<u8>() +
        size_of::<usize>() + size_of::<u8>() * GAME_ARR_LEN +
        size_of::<PlayerParams>() * 2 +
        size_of::<u16>() * 2 +
        size_of::<u64>() * 3 +
        size_of::<Phase>() +
        size_of::<Result>();

    pub fn neighborhood_board(owner: Pubkey, nx: i64, ny: i64) -> Board {
        Board {
            owner,
            nx,
            ny,
            idx: 0,
            game_arr: vec![0; GAME_ARR_LEN],
            player_white: PlayerParams::none(),
            player_black: PlayerParams::none(),
            reg_white: 0,
            reg_black: 0,
            register_deadline: 0,
            move_interval: 0,
            move_deadline: 0,
            phase: Phase::Inactive,
            result: Result::None,
        }
    }
}

pub const SPACE_METADATA_SEED: &[u8] = b"space_metadata";
pub const SPACE_PID: &str = "XSPCxeYZuYJWEuHNz3ycs4fme9UJREytiEcnsKCTMUK";

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
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitBoardArgs {
    pub neighborhood_x: i64,
    pub neighborhood_y: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct StartGameArgs {
    pub neighborhood_x: i64,
    pub neighborhood_y: i64,
    // pub board: u8,
    // pub white_whitelist: [[u8; 2]; 10],
    // pub black_whitelist: [[u8; 2]; 10],
    pub white_pubkey: Pubkey,
    pub black_pubkey: Pubkey,
    pub white_type: u8,
    pub black_type: u8,
    // pub max_white_player: u16,
    // pub max_black_player: u16,
    pub min_white_vote: u16,
    pub min_black_vote: u16,
    pub max_timeout_join: u64,
    pub max_timeout_vote: u64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct ChooseSideArgs {
    pub space_x: i64,
    pub space_y: i64,
    // pub board: u8,
    pub side: u8,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct VoteMoveArgs {
    pub space_x: i64,
    pub space_y: i64,
    // pub board: u8,
    pub num_move: u16,
    pub from: u8,
    pub to: u8,
}

pub enum ChessInstruction {
    InitBoard,
    StartGame,
    ChooseSide,
    VoteMove
}

impl ChessInstruction {
    pub fn unpack(tag: &u8) -> Result<Self, ProgramError> {
        Ok(match tag {
            0 => Self::InitBoard,
            1 => Self::StartGame,
            2 => Self::ChooseSide,
            3 => Self::VoteMove,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}

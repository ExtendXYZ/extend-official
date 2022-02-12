use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

use crate::state::{
    Move, PlayerParams, Side,
};

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitBoardArgs {
    pub nx: i64,
    pub ny: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct StartGameArgs {
    pub nx: i64,
    pub ny: i64,
    pub player_white: PlayerParams,
    pub player_black: PlayerParams,
    pub register_deadline: u64,  // timestamp
    pub move_interval: u16,      // seconds
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Space {
    pub x: i64,
    pub y: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct RegisterArgs {
    pub space: Space,
    pub side: Side,
}

// Resign is Move::none()
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct VoteArgs {
    pub space: Space,
    pub ply: u16,
    pub vote: Move,
}

pub enum ChessInstruction {
    /*
     * 0. Base account
     * 1. Board owner
     * 2. Board account
     * 3. System program
     */
    InitBoard,
    /*
     * 0. Base account
     * 1. Board owner
     * 2. Board account
     */
    StartGame,
    /*
     * 0. Base account
     * 1. Space owner
     * 2. Space account
     * 3. Board account
     */
    Register,
    /*
     * 0. Base account
     * 1. Space owner
     * 2. Space account
     * 3. Board account
     */
    Vote,
}

impl ChessInstruction {
    pub fn unpack(tag: &u8) -> Result<Self, ProgramError> {
        Ok(match tag {
            0 => Self::InitBoard,
            1 => Self::StartGame,
            2 => Self::Register,
            3 => Self::Vote,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}

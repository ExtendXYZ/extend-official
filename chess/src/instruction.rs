use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitBoardArgs {
    pub neighborhood_x: i64,
    pub neighborhood_y: i64,
}

pub enum ChessInstruction {
    InitBoard,
    StartGame,
    ChooseSide,
    VoteMove
}
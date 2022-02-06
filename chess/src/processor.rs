use borsh::BorshDeserialize;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
    pubkey::Pubkey,
};

pub mod init_board;
pub mod register;
pub mod start_game;
pub mod vote;

use crate::instruction::{
    InitBoardArgs, RegisterArgs, StartGameArgs, VoteArgs,
    ChessInstruction,
};

pub struct Processor;
impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let (tag, rest) = instruction_data
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        let instruction = ChessInstruction::unpack(tag)?;
        match instruction {
            ChessInstruction::InitBoard => {
                let args = InitBoardArgs::try_from_slice(rest)?;
                msg!("InitBoard");
                init_board::process(program_id, accounts, &args)
            }
            ChessInstruction::StartGame => {
                let args = StartGameArgs::try_from_slice(rest)?;
                msg!("StartGame");
                start_game::process(program_id, accounts, &args)
            }
            ChessInstruction::Register => {
                let args = RegisterArgs::try_from_slice(rest)?;
                msg!("Register");
                register::process(program_id, accounts, &args)
            }
            ChessInstruction::Vote => {
                let args = VoteArgs::try_from_slice(rest)?;
                msg!("Vote");
                vote::process(program_id, accounts, &args)
            }
        }
    }
}

use borsh::BorshDeserialize;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    instruction::{
        RentInstruction, SetRentArgs, AcceptRentArgs,
    },
};

pub mod set_rent;
pub mod accept_rent;

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
        let instruction = RentInstruction::unpack(tag)?;
        match instruction {
            RentInstruction::SetRent => {
                let args = SetRentArgs::try_from_slice(rest)?;
                msg!("Instruction: setting rent listing");
                set_rent::process(program_id, accounts, &args)
            }
            RentInstruction::AcceptRent => {
                let args = AcceptRentArgs::try_from_slice(rest)?;
                msg!("Instruction: accepting rent offer");
                accept_rent::process(program_id, accounts, &args)
            }
        }
    }
}

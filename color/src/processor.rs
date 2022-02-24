use borsh::BorshDeserialize;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    instruction::{
        ColorInstruction, InitFrameArgs, ChangeColorArgs, ChangeColorBriefArgs, MakeEditableArgs, MakeEditableBriefArgs, TmpChangeEditableTimestampArgs,
    },
};

pub mod init_frame;
pub mod change_color;
pub mod make_editable;
pub mod tmp_change_editable_timestamp;

pub mod processor_utils;

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
        let instruction = ColorInstruction::unpack(tag)?;
        match instruction {
            ColorInstruction::InitFrame => {
                let args = InitFrameArgs::try_from_slice(rest)?;
                msg!("Instruction: initializing color frame cluster");
                init_frame::process(program_id, accounts, &args)
            }
            ColorInstruction::ChangeColor => {
                let args = ChangeColorArgs::try_from_slice(rest)?;
                msg!("Instruction: changing color");
                change_color::process(program_id, accounts, &args)
            }
            ColorInstruction::ChangeColorBrief => {
                let args = ChangeColorBriefArgs::try_from_slice(rest)?;
                msg!("Instruction: changing color");
                change_color::process_brief(program_id, accounts, &args)
            }
            ColorInstruction::MakeEditable => {
                let args = MakeEditableArgs::try_from_slice(rest)?;
                msg!("Instruction: making editable");
                make_editable::process(program_id, accounts, &args)
            }
            ColorInstruction::MakeEditableBrief => {
                let args = MakeEditableBriefArgs::try_from_slice(rest)?;
                msg!("Instruction: making editable");
                make_editable::process_brief(program_id, accounts, &args)
            }
            ColorInstruction::TmpChangeEditableTimestamp => {
                let args = TmpChangeEditableTimestampArgs::try_from_slice(rest)?;
                msg!("Instruction: tmp change editable timestamps");
                tmp_change_editable_timestamp::process(program_id, accounts, &args)
            }
        }
    }
}

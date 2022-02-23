use borsh::BorshDeserialize;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    instruction::{
        AcceptOfferArgs, ChangeOfferArgs, SpaceInstruction, InitBaseArgs,
        InitSpaceMetadataArgs, InitNeighborhoodMetadataArgs, RevokeAuthorityPrivilegesArgs,
        InitVoucherSystemArgs, UpdateAuthorityArgs, ChangeNeighborhoodNameArgs, GetVouchersArgs
    },
};

pub mod init_base;
pub mod init_neighborhood_metadata;
pub mod init_space_metadata;
pub mod change_offer;
pub mod accept_offer;
pub mod init_voucher_system;
pub mod revoke_authority_privileges;
pub mod update_authority;
pub mod change_nbdhoodname; // elim
pub mod get_vouchers;
// pub mod temp_add_xy; // elim

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
        let instruction = SpaceInstruction::unpack(tag)?;
        match instruction {
            SpaceInstruction::InitBase => {
                let args = InitBaseArgs::try_from_slice(rest)?;
                msg!("Instruction: initializing base");
                init_base::process(program_id, accounts, &args)
            }
            SpaceInstruction::InitNeighborhoodMetadata => {
                let args = InitNeighborhoodMetadataArgs::try_from_slice(rest)?;
                msg!("Instruction: initializing neighborhood metadata");
                init_neighborhood_metadata::process(program_id, accounts, &args)
            }
            SpaceInstruction::InitSpaceMetadata => {
                let args = InitSpaceMetadataArgs::try_from_slice(rest)?;
                msg!("Instruction: initializing space metadata");
                init_space_metadata::process(program_id, accounts, &args)
            }
            SpaceInstruction::ChangeOffer => {
                let args = ChangeOfferArgs::try_from_slice(rest)?;
                msg!("Instruction: change offer");
                change_offer::process(program_id, accounts, &args)
            }
            SpaceInstruction::AcceptOffer => {
                let args = AcceptOfferArgs::try_from_slice(rest)?;
                msg!("Instruction: accept offer");
                accept_offer::process(program_id, accounts, &args)
            }
            SpaceInstruction::InitVoucherSystem => {
                let args = InitVoucherSystemArgs::try_from_slice(rest)?;
                msg!("Instruction: initialize voucher system");
                init_voucher_system::process(program_id, accounts, &args)
            }
            SpaceInstruction::RevokeAuthorityPrivileges => {
                let args = RevokeAuthorityPrivilegesArgs::try_from_slice(rest)?;
                msg!("Instruction: revoke authority privileges");
                revoke_authority_privileges::process(program_id, accounts, &args)
            }
            SpaceInstruction::UpdateAuthority => {
                let args = UpdateAuthorityArgs::try_from_slice(rest)?;
                msg!("Instruction: update authority");
                update_authority::process(program_id, accounts, &args)
            }
            SpaceInstruction::ChangeNeighborhoodName => {
                let args = ChangeNeighborhoodNameArgs::try_from_slice(rest)?;
                msg!("Instruction: change neighborhood name");
                change_nbdhoodname::process(program_id, accounts, &args)
            }
            SpaceInstruction::GetVouchers => {
                let args = GetVouchersArgs::try_from_slice(rest)?;
                msg!("Instruction: change neighborhood name");
                get_vouchers::process(program_id, accounts, &args)
            }
            // SpaceInstruction::TempAddxy => { // elim
            //     let args = TempAddxyArgs::try_from_slice(rest)?; // elim
            //     msg!("TEMP INSTRUCTION: ADD THEM XYs"); // elim
            //     temp_add_xy::process(program_id, accounts, &args) // elim
            // }
        }
    }
}

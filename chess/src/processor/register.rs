use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};
use std::str::FromStr;

use crate::{
    error::CustomError,
    instruction::RegisterArgs,
    utils::assert_keys_equal,
    state::{
        Board,
        Phase,
    }
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &RegisterArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let space_owner = next_account_info(account_info_iter)?;
    let space_account = next_account_info(account_info_iter)?;
    let board_account = next_account_info(account_info_iter)?;
    // Space account is signer
    if !space_owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    // Board is initialized
    msg!("r space {:?}", args.space);
    msg!("r side {:?}", args.side);
    let mut board_state: Board = try_from_slice_unchecked(&board_account.data.borrow())?;
    // Board is currently registering
    if board_state.phase != Phase::Registering {
        return Err(CustomError::IncorrectPhase.into());
    }
    // Check if deadline has passed, short-circuit if so
    //      Advance phase if conditions met
    //      Extend deadline if not
    // Space is inside neighborhood
    // Account owns space
    // Space is not already assigned
    // Assign space
    Ok(())
}
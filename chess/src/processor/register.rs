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
    let board_owner = next_account_info(account_info_iter)?;
    let board_account = next_account_info(account_info_iter)?;
    // Space account is signer
    // Board PDA derived correctly
    // Board is initialized and registering
    // Check if deadline has passed, short-circuit if so
    //      Advance phase if conditions met
    //      Extend deadline if not
    // Space is inside neighborhood
    // Account owns space
    // Space is not already assigned
    // Assign space
    // Advance phase if applicable
    Ok(())
}
use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_program,
};
use std::str::FromStr;

use crate::{
    error::CustomError,
    instruction::StartGameArgs,
    utils::assert_keys_equal,
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &StartGameArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let board_owner = next_account_info(account_info_iter)?;
    let board_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    // System program ID is correct
    assert_keys_equal(system_program::id(), *system_program.key)?;
    // Account is signer
    // Board PDA derived correctly
    // Board is initialized
    // Board is inactive
    // Interval_keep is satisfied
    // PKs are valid if given
    // Quorum values are valid if given
    // Intervals are valid
    // Initialize parameters and set the registration end
    Ok(())
}
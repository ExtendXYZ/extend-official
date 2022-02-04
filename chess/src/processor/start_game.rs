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
    instruction::StartGameArgs,
    utils::assert_keys_equal,
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &StartGameArgs,
) -> ProgramResult {
    // System program ID is correct
    // Account is signer
    // PDA derived correctly
    // Board is initialized
    // Board is inactive
    // Interval_keep is satisfied
    // PKs are valid if given
    // Quorum values are valid if given
    // Intervals are valid
    // Initialize parameters and set the registration end
    Ok(())
}
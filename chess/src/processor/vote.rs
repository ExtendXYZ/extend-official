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
    instruction::VoteArgs,
    utils::assert_keys_equal,
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &VoteArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let space_owner = next_account_info(account_info_iter)?;
    let space_account = next_account_info(account_info_iter)?;
    let board_owner = next_account_info(account_info_iter)?;
    let board_account = next_account_info(account_info_iter)?;
    // Space account is signer
    // Board PDA derived correctly
    // Board is initialized and active
    // Check if deadline has passed, short-circuit if so
    //      Apply move, update state if valid winning move
    //      Check for termination and advance phase if applicable
    // Space is inside neighborhood
    // Account owns space
    // Space is assigned to the side to move
    // Space is not already voted
    // Ply is correct
    // Move is valid
    // Record vote
    Ok(())
}
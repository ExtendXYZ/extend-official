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
    // System program ID is correct
    // Account is signer
    // PDA derived correctly
    // Board is initialized and active
    // Space is inside neighborhood
    // Account owns space
    // Space is assigned to the side to move
    // Space is not already voted
    // Ply is correct
    // Move is valid
    // Apply move and update state
    // Advance phase if applicable
    Ok(())
}
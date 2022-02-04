use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction, system_program,
    sysvar::rent::Rent,
};
use std::str::FromStr;

use crate::{
    instruction::InitBoardArgs,
    utils::assert_keys_equal,
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &InitBoardArgs,
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
    // Board is not already initialized
    // Initialize and serialize inactive game
    Ok(())
}
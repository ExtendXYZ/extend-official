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
    state::{
        Board,
        Phase,
    }
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
    let board_account = next_account_info(account_info_iter)?;
    // Space account is signer
    if !space_owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    // Board is initialized
    msg!("r space {:?}", args.space);
    msg!("r ply {:?}", args.ply);
    msg!("r vote {:?}", args.vote);
    let mut board_state: Board = try_from_slice_unchecked(&board_account.data.borrow())?;
    // Board is currently active
    if board_state.phase != Phase::Active {
        return Err(CustomError::IncorrectPhase.into());
    }
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
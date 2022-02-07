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
    state::{
        Board,
        Phase,
    },
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
    // Board owner is signer
    if !board_owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    // Board is readable
    msg!("sg nb {:?}", args.neighborhood);
    msg!("sg pw {:?}", args.player_white);
    msg!("sg pb {:?}", args.player_black);
    msg!("sg ir {:?}", args.interval_register);
    msg!("sg im {:?}", args.interval_move);
    msg!("sg ik {:?}", args.interval_keep);
    let mut board_state: Board = try_from_slice_unchecked(&board_account.data.borrow())?;
    msg!("owner {:?}", board_state.owner);
    msg!("x {:?}", board_state.nx);
    msg!("y {:?}", board_state.ny);
    // Board data matches
    assert_keys_equal(board_state.owner, *board_owner.key);
    // Board state is inactive
    if board_state.phase != Phase::Inactive {
        return Err(CustomError::IncorrectPhase.into());
    }
    // Interval_keep is satisfied
    // PKs are valid if given
    // Quorum values are valid if given
    // Intervals are valid
    // Initialize parameters and set the registration end
    Ok(())
}
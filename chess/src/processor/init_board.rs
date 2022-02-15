use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_program,
};

use crate::{
    error::CustomError,
    instruction::InitBoardArgs,
    utils::assert_keys_equal,
    state::Board,
};

pub fn process(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &InitBoardArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let board_owner = next_account_info(account_info_iter)?;
    let board_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    // System program ID is correct
    assert_keys_equal(system_program::id(), *system_program.key)?;

    // Board owner is signer
    if !board_owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Board is not already initialized
    if board_account.data_len() == 0 {
        msg!("Board account not initialized");
        return Err(CustomError::UninitializedBoard.into());
    }

    // Initialize board data
    msg!("Initializing board data");
    let board = Board::neighborhood_board(*board_owner.key, args.nx, args.ny);
    let board_data = &mut *board_account.data.borrow_mut();

    board.serialize(board_data)?;

    Ok(())
}
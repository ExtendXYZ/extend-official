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
    error::CustomError,
    instruction::InitBoardArgs,
    utils::assert_keys_equal,
    state::{
        BOARD_SEED,
        Board,
    },
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

    // Board owner is signer
    if !board_owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Board PDA derived correctly
    let seeds_createboard = &[
        &base.key.to_bytes(),
        BOARD_SEED,
        &args.neighborhood.x.to_le_bytes(),
        &args.neighborhood.y.to_le_bytes(),
    ];
    let (key, board_bump) = Pubkey::find_program_address(seeds_createboard, program_id);
    assert_keys_equal(key, *board_account.key)?;
    let seeds_board = &[
        &base.key.to_bytes(),
        BOARD_SEED,
        &args.neighborhood.x.to_le_bytes(),
        &args.neighborhood.y.to_le_bytes(),
        &[board_bump],
    ];

    // Board is not already initialized
    if board_account.data_len() != 0 {
        msg!("Board already initialized");
        return Err(CustomError::AlreadyInitializedBoard.into());
    }

    // Initialize account
    msg!("Initializing board account");
    let required_lamports = Rent::default()
        .minimum_balance(Board::LEN)
        .max(1)
        .saturating_sub(board_account.lamports());
    invoke_signed(
        &system_instruction::create_account(
            board_owner.key,
            board_account.key,
            required_lamports,
            Board::LEN as u64,
            program_id,
        ),
        &[
            board_owner.clone(),
            board_account.clone(),
            system_program.clone(),
        ],
        &[seeds_board],
    )?;

    // Serialize inactive game
    let board = Board::neighborhood_board(*board_owner.key);
    let board_data = &mut *board_account.data.borrow_mut();

    board.serialize(board_data)?;

    Ok(())
}
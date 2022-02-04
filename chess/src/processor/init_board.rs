use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program::{invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction, system_program,
    sysvar::rent::Rent,
};
use std::mem::size_of;
use std::str::FromStr;

use crate::{
    instruction::InitBoardArgs,
    state::{
        NEIGHBORHOOD_SIZE,
        NEIGHBORHOOD_BOARD_BASE_SEED,
        NEIGHBORHOOD_BOARD_BASE_RESERVE,
        NeighborhoodBoardBase,
        Board,
        Phase,
    },
    validation_utils::assert_keys_equal,
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &InitBoardArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let board = next_account_info(account_info_iter)?;
    let neighborhood_board_base = next_account_info(account_info_iter)?;
    let fee_payer = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    // check signers
    if !fee_payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // check programs
    assert_keys_equal(system_program::id(), *system_program.key)?;

    // check PDA of neighborhood board base account and create it if necessary
    let seeds_neighborhood_board_base = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_BOARD_BASE_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
    ];
    let (key, neighborhood_board_base_bump) = Pubkey::find_program_address(seeds_neighborhood_board_base, program_id);
    assert_keys_equal(key, *neighborhood_board_base.key)?;
    let seeds_neighborhood_board_base = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_BOARD_BASE_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
        &[neighborhood_board_base_bump],
    ];
    let mut neighborhood_board_base_data: NeighborhoodBoardBase;
    // create NeighborhoodBoardBase account
    let required_lamports = Rent::default()
        .minimum_balance(NEIGHBORHOOD_BOARD_BASE_RESERVE)
        .max(1)
        .saturating_sub(neighborhood_board_base.lamports());
    invoke_signed(
        &system_instruction::create_account(
            fee_payer.key,
            neighborhood_board_base.key,
            required_lamports,
            NEIGHBORHOOD_BOARD_BASE_RESERVE as u64,
            program_id,
        ),
        &[
            fee_payer.clone(),
            neighborhood_board_base.clone(),
            system_program.clone(),
        ],
        &[seeds_neighborhood_board_base],
    )?;
    // write bump seed and board address
    neighborhood_board_base_data = try_from_slice_unchecked(&neighborhood_board_base.data.borrow_mut())?;
    neighborhood_board_base_data.bump = neighborhood_board_base_bump;
    neighborhood_board_base_data.boardkey = *board.key;
    neighborhood_board_base_data.serialize(&mut *neighborhood_board_base.data.borrow_mut())?;
    
    // zero out data in color cluster
    let mut board_data: Board = try_from_slice_unchecked(&board.data.borrow_mut())?;
    board_data.phase = Phase::Initialized;
    board_data.serialize(&mut *board.data.borrow_mut())?;

    Ok(())
}

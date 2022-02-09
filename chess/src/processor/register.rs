use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    error::CustomError,
    instruction::RegisterArgs,
    utils::{
        get_neighborhood_xy,
        get_index,
    },
    state::{
        Board,
        Phase,
    }
};

pub fn process(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &RegisterArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let _base = next_account_info(account_info_iter)?;
    let space_owner = next_account_info(account_info_iter)?;
    let _space_account = next_account_info(account_info_iter)?;
    let board_account = next_account_info(account_info_iter)?;

    // Space account is signer
    if !space_owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Board is initialized
    msg!("r space {:?}", args.space);
    msg!("r side {:?}", args.side);
    let board_state: Board = try_from_slice_unchecked(&board_account.data.borrow())?;

    // Board is currently registering
    if board_state.phase != Phase::Registering {
        return Err(CustomError::IncorrectPhase.into());
    }

    // Check if deadline has passed, short-circuit if so
    //      Advance phase if conditions met
    //      Extend deadline if not
    //      TODO

    // Space is inside neighborhood
    let (nx, ny) = get_neighborhood_xy(args.space.x, args.space.y);
    if nx != board_state.nx || ny != board_state.ny {
        return Err(CustomError::SpaceOutsideNeighborhood.into());
    }

    // Account owns space
    // TODO

    // Assign space
    let space_index = Board::LEN + get_index(args.space.x, args.space.y);
    let space_data = &mut (&mut board_account.data.borrow_mut()[space_index..space_index+1]);
    args.side.serialize(space_data)?;

    Ok(())
}
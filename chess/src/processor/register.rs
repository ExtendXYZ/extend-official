use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::Sysvar,
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
    let mut board_state: Board = try_from_slice_unchecked(&board_account.data.borrow())?;
    let board_data = &mut *board_account.data.borrow_mut();

    // Board is currently registering
    if board_state.phase != Phase::Registering {
        return Err(CustomError::IncorrectPhase.into());
    }

    // Check if deadline has passed, short-circuit if so
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    if board_state.next_deadline < now_ts {
        msg!("Deadline hit, checking whether to advance phase");
        let mut advance = false;
        if board_state.player_white.has_pk && board_state.player_black.has_pk {
            advance = true;
        } else {
            // Quorum met where applicable
            // TODO
        }
        if advance {
            msg!("Advance phase to active");
            board_state.phase = Phase::Active;
            board_state.next_deadline = now_ts + board_state.interval_move;
            board_state.serialize(board_data)?;
            return Ok(());
        } else {
            msg!("Conditions not met; extending");
            board_state.next_deadline = now_ts + board_state.interval_register;
            board_state.serialize(board_data)?;
        }
    }

    // Account owns space
    // TODO

    // Space is inside neighborhood
    let (nx, ny) = get_neighborhood_xy(args.space.x, args.space.y);
    if nx != board_state.nx || ny != board_state.ny {
        return Err(CustomError::SpaceOutsideNeighborhood.into());
    }

    // Assign space
    let space_index = Board::LEN + get_index(args.space.x, args.space.y);
    let space_data = &mut (&mut board_data[space_index..space_index+1]);
    args.side.serialize(space_data)?;

    Ok(())
}
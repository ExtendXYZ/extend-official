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
use std::mem::size_of;

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
        Reg,
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

    // Parse board
    msg!("r space {:?}", args.space);
    msg!("r side {:?}", args.side);
    let board_state: Board = try_from_slice_unchecked(&board_account.data.borrow())?;
    let board_data = &mut *board_account.data.borrow_mut();

    // Board is currently registering
    if board_state.phase != Phase::Registering {
        return Err(CustomError::IncorrectPhase.into());
    }

    // Deadline not yet elapsed
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    if board_state.register_deadline < now_ts {
        msg!("Cannot register - past deadline");
        return Err(CustomError::PastRegistrationDeadline.into());
    }

    // Account owns space
    // TODO

    // Space inside neighborhood
    let (nx, ny) = get_neighborhood_xy(args.space.x, args.space.y);
    if nx != board_state.nx || ny != board_state.ny {
        return Err(CustomError::SpaceOutsideNeighborhood.into());
    }

    // Assign space
    let space_index = get_index(args.space.x, args.space.y);
    let reg_size = size_of::<Reg>();
    let reg_start: usize = Board::LEN + space_index * reg_size;
    let reg = Reg {idx: board_state.idx, side: args.side};
    let space_data: &mut &mut[u8] = &mut (&mut board_data[reg_start..reg_start+reg_size]);
    reg.serialize(space_data)?;

    Ok(())
}
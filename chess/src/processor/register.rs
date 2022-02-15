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
        REG_START,
        Board,
        Phase,
        Reg,
        Side,
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

    // Args valid
    if args.side == Side::Undefined {
        return Err(CustomError::InvalidRegisterArgs.into());
    }

    // Parse board
    msg!("Space: {:?}", args.space);
    msg!("Side: {:?}", args.side);
    let board_data: &mut &mut [u8] = &mut *board_account.data.borrow_mut();
    let mut board_state: Board = try_from_slice_unchecked(&board_data[0..Board::LEN])?;

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

    // Space not already registered
    msg!("Checking space registration");
    let space_index = get_index(args.space.x, args.space.y);
    let reg_size = size_of::<Reg>();
    let reg_index: usize = REG_START + space_index * reg_size;
    let side_registered: Reg = try_from_slice_unchecked(&board_data[reg_index..reg_index+reg_size])?;
    if side_registered.idx == board_state.idx {
        return Err(CustomError::AlreadyRegistered.into());
    }

    // Assign space
    msg!("Assigning space");
    let reg = Reg {idx: board_state.idx, side: args.side};
    reg.serialize(&mut &mut board_data[reg_index..reg_index+reg_size])?;

    // Update count
    msg!("Updating registration count");
    match args.side {
        Side::White => board_state.reg_white += 1,
        Side::Black => board_state.reg_black += 1,
        _ => panic!("Unexpected side arg"),
    }
    board_state.serialize(board_data)?;

    Ok(())
}
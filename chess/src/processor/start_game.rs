use borsh::BorshSerialize;
use legal_chess::{
    chessmove::ChessMove,
    game::Game
};
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_program,
    sysvar::Sysvar,
    log::sol_log_compute_units,
};
use std::str::FromStr;

use crate::{
    error::CustomError,
    instruction::StartGameArgs,
    utils::assert_keys_equal,
    state::{
        NEIGHBORHOOD_SPACES,
        RESTRICTED_SPACES,
        MAX_INTERVAL_REGISTER,
        MAX_INTERVAL_MOVE,
        MAX_INTERVAL_KEEP,
        MIN_INTERVAL_REGISTER,
        MIN_INTERVAL_MOVE,
        MIN_INTERVAL_KEEP,
        MAX_QUORUM_REGISTER,
        MAX_QUORUM_MOVE,
        MIN_QUORUM_REGISTER,
        MIN_QUORUM_MOVE,
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
    // TODO
    for player in [&args.player_white, &args.player_black] {
        if player.has_pk {
            // PK valid
            // TODO
        } else {
            // Quorum valid
            if player.quorum_register > MAX_QUORUM_REGISTER || player.quorum_register < MIN_QUORUM_REGISTER ||
                player.quorum_move > MAX_QUORUM_MOVE || player.quorum_move < MIN_QUORUM_MOVE {
                msg!("Quorum outside limits");
                return Err(CustomError::InvalidStartGameArgs.into());
            }
        }
    }

    // Intervals are valid
    if args.interval_register > MAX_INTERVAL_REGISTER || args.interval_register < MIN_INTERVAL_REGISTER ||
        args.interval_move > MAX_INTERVAL_MOVE || args.interval_move < MIN_INTERVAL_MOVE ||
        args.interval_keep > MAX_INTERVAL_KEEP || args.interval_keep < MIN_INTERVAL_KEEP {
        msg!("Interval outside limits");
        return Err(CustomError::InvalidStartGameArgs.into());
    }

    // Initialize parameters and set the registration end
    let game = Game::new();
    board_state.game_arr = game.to_game_arr().to_vec();
    board_state.player_white = args.player_white;
    board_state.player_black = args.player_black;
    board_state.interval_register = args.interval_register;
    board_state.interval_move = args.interval_move;
    board_state.interval_keep = args.interval_keep;

    // Set registration end
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    board_state.next_deadline = now_ts + args.interval_register;
    msg!("Board: {:?}", board_state);

    // Write the board
    let board_data = &mut *board_account.data.borrow_mut();
    board_state.serialize(board_data);

    // Zero out the assignment bytes
    let sideStart = Board::LEN;
    for i in 0..RESTRICTED_SPACES {
        board_data[sideStart+i] = 0;
    }

    // Zero out the vote bytes
    let voteStart = Board::LEN + NEIGHBORHOOD_SPACES;
    for i in 0..RESTRICTED_SPACES {
        board_data[sideStart+i] = 0;
    }

    Ok(())
}
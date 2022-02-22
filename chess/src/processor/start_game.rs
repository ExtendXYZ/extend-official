use borsh::BorshSerialize;
use legal_chess::game::Game;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    error::CustomError,
    instruction::StartGameArgs,
    utils::{
        assert_keys_equal,
        display_game,
        reset_votes,
    },
    state::{
        Board,
        Phase,
        Result,
    },
};

pub fn process(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &StartGameArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let board_owner = next_account_info(account_info_iter)?;
    let board_account = next_account_info(account_info_iter)?;

    // Board owner is signer
    if !board_owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Board owner matches
    let mut board_state: Board = try_from_slice_unchecked(&board_account.data.borrow())?;
    assert_keys_equal(board_state.owner, *board_owner.key)?;

    // Board state is inactive
    if board_state.phase != Phase::Inactive {
        return Err(CustomError::IncorrectPhase.into());
    }

    // Advance idx, wrap if necessary
    board_state.idx = match board_state.idx { 255 => 0, _ => board_state.idx + 1};

    // Initialize parameters and set the registration end
    let game = Game::new();
    board_state.game_arr = game.to_game_arr().to_vec();
    board_state.player_white = args.player_white;
    board_state.player_black = args.player_black;
    board_state.reg_white = 0;
    board_state.reg_black = 0;
    board_state.register_deadline = args.register_deadline;
    board_state.move_interval = args.move_interval as u64;
    board_state.phase = Phase::Registering;
    board_state.result = Result::None;
    display_game(&game);

    // Write the board
    let board_data = &mut *board_account.data.borrow_mut();
    board_state.serialize(&mut &mut board_data[0..Board::LEN])?;

    // Reset votes
    reset_votes(board_data)?;

    Ok(())
}
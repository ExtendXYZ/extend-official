use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};
use legal_chess::{
    color::Color,
    game::Game,
};

use crate::{
    error::CustomError,
    instruction::VoteArgs,
    utils::{
        get_index,
        get_neighborhood_xy,
        side_to_color,
        display_game,
        assert_keys_equal,
    },
    state::{
        Board,
        Phase,
        Side,
        NEIGHBORHOOD_SPACES,
    }
};

pub fn process(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &VoteArgs,
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
    msg!("r ply {:?}", args.ply);
    msg!("r vote {:?}", args.vote);
    let mut board_state: Board = try_from_slice_unchecked(&board_account.data.borrow())?;
    let board_data = &mut *board_account.data.borrow_mut();
    let mut game = Game::from_game_arr(&board_state.game_arr);
    display_game(&game);

    // Board is currently active
    if board_state.phase != Phase::Active {
        return Err(CustomError::IncorrectPhase.into());
    }

    // Ply is correct
    if args.ply/2 != game.full_moves() {
        return Err(CustomError::PlyMismatch.into());
    }

    // Move is valid
    let chess_move = args.vote.convert();
    if !game.legal_moves().contains(&chess_move) {
        msg!("Not a legal move");
        return Err(CustomError::IllegalMove.into());
    }

    // Account owns space
    // TODO

    // If player is PK, just play the move
    let mut terminate_game = false;
    let active_player = match game.side_to_move() {
        Color::WHITE => board_state.player_white,
        Color::BLACK => board_state.player_black,
    };
    if active_player.has_pk {
        assert_keys_equal(active_player.player_pk, *space_owner.key)?;
        game.make_move(chess_move);
        board_state.game_arr = game.to_game_arr().to_vec();
        board_state.serialize(board_data)?;
        if game.legal_moves().is_empty() { terminate_game = true; }
    }

    // If deadline has passed, apply the vote
    //      Count votes, apply move, update state
    // TODO

    // Terminate if applicable
    if terminate_game {
        msg!("Game over");
        display_game(&game);
        board_state.phase = Phase::Inactive;
        board_state.serialize(board_data)?;
        return Ok(());
    }

    // Space is inside neighborhood
    let (nx, ny) = get_neighborhood_xy(args.space.x, args.space.y);
    if nx != board_state.nx || ny != board_state.ny {
        return Err(CustomError::SpaceOutsideNeighborhood.into());
    }
    let space_index = get_index(args.space.x, args.space.y);

    // Space is assigned to the side to move
    let side_start = Board::LEN;
    let side_index: usize = side_start + space_index;
    let side_registered: Side = try_from_slice_unchecked(&board_account.data.borrow()[side_index..side_index+1])?;
    if side_to_color(side_registered) != *game.side_to_move() {
        return Err(CustomError::PlayerMismatch.into());
    }

    // Record vote
    let vote_start = Board::LEN + NEIGHBORHOOD_SPACES;
    let vote_index = vote_start + 3*space_index;
    let vote_data = &mut (&mut board_account.data.borrow_mut()[vote_index..vote_index+3]);
    args.vote.serialize(vote_data)?;

    Ok(())
}
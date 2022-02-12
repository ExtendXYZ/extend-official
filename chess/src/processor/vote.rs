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
use legal_chess::{
    color::Color,
    game::Game,
};
use std::mem::size_of;

use crate::{
    error::CustomError,
    instruction::VoteArgs,
    utils::{
        Dir,
        get_index,
        get_neighborhood_xy,
        side_to_color,
        display_game,
        assert_keys_equal,
        has_voted,
        update_vote,
        mod_ply,
    },
    state::{
        Board,
        Phase,
        Reg,
        Vote,
        TALLY_OFFSET,
        REG_OFFSET,
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
    let mut board_state: Board = try_from_slice_unchecked(&board_account.data.borrow())?;
    let board_data = &mut *board_account.data.borrow_mut();
    let mut game = Game::from_game_arr(&board_state.game_arr);

    if board_state.phase == Phase::Registering {
        msg!("Still in registration, checking whether to advance");
        let now_ts = Clock::get().unwrap().unix_timestamp as u64;
        if board_state.register_deadline < now_ts {
            msg!("Deadline hit, checking players");
            let mut advance = true;
            advance &= board_state.player_white.has_pk || board_state.reg_white > 0;
            advance &= board_state.player_black.has_pk || board_state.reg_black > 0;
            if advance {
                msg!("Players registered, starting game");
                board_state.phase = Phase::Active;
                board_state.move_deadline = board_state.register_deadline + board_state.move_interval;
            } else {
                msg!("Extending registration - players not ready");
                board_state.move_deadline = now_ts + board_state.move_interval;
                board_state.serialize(board_data)?;
                return Ok(());
            }
        }
    }

    // Now board should be active
    if board_state.phase != Phase::Active {
        msg!("Cannot vote unless game is active");
        return Err(CustomError::IncorrectPhase.into());
    }

    // Update board with move if move deadline expired
    // Count votes, apply move or resign, update state
    // Reset votes: SET VOTES COUNT TO ZERO
    // TODO

    // Ply is correct
    if (args.ply/2 + 1) != game.full_moves() {
        msg!("Mismatched ply");
        return Err(CustomError::PlyMismatch.into());
    }

    // Move is valid
    let chess_move = args.vote.convert();
    msg!("Move: {:?}", chess_move);
    if !game.legal_moves().contains(&chess_move) {
        msg!("Not a legal move");
        return Err(CustomError::IllegalMove.into());
    }

    // Account owns space
    // TODO

    // If player is PK, play move
    let mut terminate_game = false;
    let active_player = match game.side_to_move() {
        Color::WHITE => board_state.player_white,
        Color::BLACK => board_state.player_black,
    };
    if active_player.has_pk {
        assert_keys_equal(active_player.player_pk, *space_owner.key)?;
        game.make_move(chess_move);
        msg!("Made move");
        board_state.game_arr = game.to_game_arr().to_vec();
        board_state.move_deadline = Clock::get().unwrap().unix_timestamp as u64 + board_state.move_interval;
        if game.legal_moves().is_empty() {
            terminate_game = true;
        } else {
            display_game(&game);
            board_state.serialize(board_data)?;
            return Ok(());
        }
    }

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

    // Space is assigned to the side to move for this game
    let side_start = Board::LEN;
    let reg_size = size_of::<Reg>();
    let reg_start: usize = side_start + space_index * reg_size;
    let side_registered: Reg = try_from_slice_unchecked(&board_account.data.borrow()[reg_start..reg_start+reg_size])?;
    if side_registered.idx != board_state.idx {
        return Err(CustomError::UnregisteredSpace.into());
    }
    if side_to_color(side_registered.side) != *game.side_to_move() {
        return Err(CustomError::PlayerMismatch.into());
    }

    // Tally vote, decrementing if this space has previously voted
    let vote_start = Board::LEN + TALLY_OFFSET + REG_OFFSET;
    let vote_size = size_of::<Vote>();
    let vote_index = vote_start + space_index * vote_size;
    let prior_vote: Vote = try_from_slice_unchecked(&board_account.data.borrow()[vote_index..vote_index+vote_size])?;
    let current_vote: Vote = Vote {
        idx: board_state.idx,
        ply: mod_ply(args.ply),
        mv: args.vote,
    };
    if has_voted(&prior_vote, &current_vote) {
        update_vote(board_data, &current_vote, Dir::Upvote)?;
    }
    update_vote(board_data, &current_vote, Dir::Downvote)?;
    board_state.serialize(board_data)?;

    // Also record this vote for the Space itself
    let vote_data = &mut (&mut board_account.data.borrow_mut()[vote_index..vote_index+vote_size]);
    current_vote.serialize(vote_data)?;

    Ok(())
}
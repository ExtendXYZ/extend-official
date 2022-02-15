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
    chessmove::ChessMove,
    color::Color,
    game::Game,
};
use std::mem::size_of;

use crate::{
    error::CustomError,
    instruction::VoteArgs,
    utils::{
        assert_keys_equal,
        assert_valid_owned_space,
        Dir,
        get_index,
        get_neighborhood_xy,
        side_to_color,
        has_voted,
        now_ts,
        reset_votes,
        update_vote,
        mod_ply,
        tally_winner,
    },
    utils_chess::moves_and_king_attacked,
    state::{
        Board,
        Phase,
        Reg,
        Result,
        Vote,
        REG_START,
        VOTE_START,
        RESIGN_MOVE,
    }
};

pub fn process(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &VoteArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let space_owner = next_account_info(account_info_iter)?;
    let space_meta = next_account_info(account_info_iter)?;
    let space_ata = next_account_info(account_info_iter)?;
    let board_account = next_account_info(account_info_iter)?;

    // Space account is signer
    if !space_owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Board is initialized
    let board_data: &mut &mut [u8] = &mut *board_account.data.borrow_mut();
    let mut board_state: Board = try_from_slice_unchecked(&board_data[0..Board::LEN])?;
    let mut game = Game::from_game_arr(&board_state.game_arr);
    let active_player = match game.side_to_move() {
        Color::WHITE => board_state.player_white,
        Color::BLACK => board_state.player_black,
    };
    msg!("Phase: {:?}", board_state.phase);

     // Activate game if necessary
    let both_pk = board_state.player_white.has_pk && board_state.player_black.has_pk;
    if both_pk && board_state.phase == Phase::Registering {
        msg!("Activating");
        board_state.phase = Phase::Active;
        board_state.move_deadline = now_ts() + board_state.move_interval;
    } else if board_state.phase == Phase::Registering {
        msg!("Still in registration, checking whether to advance");
        let now = now_ts();
        if board_state.register_deadline < now {
            msg!("Deadline hit, checking players");
            let mut advance = true;
            advance &= board_state.player_white.has_pk || board_state.reg_white > 0;
            advance &= board_state.player_black.has_pk || board_state.reg_black > 0;
            if advance {
                msg!("Players registered, starting game");
                board_state.phase = Phase::Active;
                board_state.move_deadline = now + board_state.move_interval;
            } else {
                msg!("Extending registration - players not ready");
                board_state.register_deadline = now + board_state.move_interval;
            }
            board_state.serialize(board_data)?;
            return Ok(());
        }
    }

    // Now board should be active
    if board_state.phase != Phase::Active {
        msg!("Cannot vote unless game is active");
        return Err(CustomError::IncorrectPhase.into());
    }

    // Terminate game if necessary
    let (legal_moves, king_attacked) = moves_and_king_attacked(&game);
    if legal_moves.is_empty() {
        msg!("Game over");
        board_state.result = match king_attacked {
            false => Result::Draw,
            true => match game.side_to_move() {
                Color::WHITE => Result::BlackWin,
                Color::BLACK => Result::WhiteWin,
            },
        };
        board_state.phase = Phase::Inactive;
        board_state.serialize(board_data)?;
        return Ok(());
    }

    // If deadline expired: count votes, apply move or resign, update state
    // Also triggers if PK player failed to vote
    if board_state.move_deadline < now_ts() {
        msg!("Move deadline hit, tallying");
        tally_and_apply(board_data, &mut board_state, &mut game)?;
        reset_votes(board_data)?;
        board_state.serialize(board_data)?;
        return Ok(());
    }

    // Ply is correct
    if (args.ply/2 + 1) != game.full_moves() {
        msg!("Mismatched ply");
        return Err(CustomError::PlyMismatch.into());
    }

    // Move is valid
    let chess_move = args.vote.convert();
    msg!("Move: {:?}", chess_move);
    if args.vote != RESIGN_MOVE && !legal_moves.contains(&chess_move) {
        msg!("Not a legal move");
        return Err(CustomError::IllegalMove.into());
    }

    // Space is inside neighborhood
    let (nx, ny) = get_neighborhood_xy(args.space.x, args.space.y);
    if nx != board_state.nx || ny != board_state.ny {
        return Err(CustomError::SpaceOutsideNeighborhood.into());
    }

    // Account owns space
    assert_valid_owned_space(base, space_owner, space_meta, space_ata, &args.space)?;

    // If player is PK, play move or resign
    if active_player.has_pk {
        assert_keys_equal(active_player.player_pk, *space_owner.key)?;
        match args.vote {
            RESIGN_MOVE => apply_resign(&mut board_state, &mut game)?,
            _ => apply_move(&mut board_state, &mut game, chess_move)?,
        };
        board_state.serialize(board_data)?;
        return Ok(());
    }

    // Space is assigned to the side to move for this game
    let space_index = get_index(args.space.x, args.space.y);
    let reg_size = size_of::<Reg>();
    let reg_index: usize = REG_START + space_index * reg_size;
    let side_registered: Reg = try_from_slice_unchecked(&board_data[reg_index..reg_index+reg_size])?;
    if side_registered.idx != board_state.idx {
        return Err(CustomError::UnregisteredSpace.into());
    }
    if side_to_color(side_registered.side) != *game.side_to_move() {
        return Err(CustomError::PlayerMismatch.into());
    }

    // Tally vote, decrementing if this space has previously voted
    let vote_size = size_of::<Vote>();
    let vote_index = VOTE_START + space_index * vote_size;
    let prior_vote: Vote = try_from_slice_unchecked(&board_data[vote_index..vote_index+vote_size])?;
    let current_vote: Vote = Vote {
        idx: board_state.idx,
        ply: mod_ply(args.ply),
        mv: args.vote,
    };
    if has_voted(&prior_vote, &current_vote) {
        update_vote(board_data, &current_vote, Dir::Downvote)?;
    }
    update_vote(board_data, &current_vote, Dir::Upvote)?;

    // Also record this vote for the Space itself
    let vote_data = &mut (&mut board_data[vote_index..vote_index+vote_size]);
    current_vote.serialize(vote_data)?;

    board_state.serialize(board_data)?;
    Ok(())
}

pub fn apply_resign(board_state: &mut Board, game: &mut Game) -> ProgramResult {
    msg!("Player resigned");
    board_state.result = match game.side_to_move() {
        Color::WHITE => Result::BlackWin,
        Color::BLACK => Result::WhiteWin,
    };
    board_state.phase = Phase::Inactive;
    Ok(())
}

pub fn apply_move(
    board_state: &mut Board,
    game: &mut Game,
    chess_move: ChessMove
) -> ProgramResult {
    game.make_move(chess_move);
    msg!("Made move");
    board_state.game_arr = game.to_game_arr().to_vec();
    board_state.move_deadline = now_ts() + board_state.move_interval;
    Ok(())
}

pub fn tally_and_apply(
    board_data: &mut &mut [u8],
    board_state: &mut Board,
    game: &mut Game,
) -> ProgramResult {
    msg!("Counting votes and updating");
    let winner = tally_winner(board_data)?;
    if winner.count == 0 {
        msg!("No votes; resign");
        board_state.result = match game.side_to_move() {
            Color::WHITE => Result::WhiteWin,
            Color::BLACK => Result::BlackWin,
        };
        board_state.phase = Phase::Inactive;
    } else {
        msg!("Winner: {:?}", winner);
        match winner.vote.mv {
            RESIGN_MOVE => apply_resign(board_state, game)?,
            _ => apply_move(board_state, game,winner.vote.mv.convert())?,
        }
    }
    Ok(())
}
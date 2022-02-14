use borsh::BorshSerialize;
use solana_program::{
    account_info::AccountInfo,
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack},
    pubkey::Pubkey,
};
use legal_chess::{
    color::Color,
    game::Game,
    pieces::{piece::PieceEnum, position},
};
use std::{
    convert::TryInto,
    mem::size_of,
};

use super::error::CustomError;
use crate::state::{
    Board,
    Side,
    Vote,
    VoteCount,
    NEIGHBORHOOD_SIDE,
};

pub fn assert_keys_equal(key1: Pubkey, key2: Pubkey) -> ProgramResult {
    if key1 != key2 {
        msg!("Validation failed: keys not equal");
        Err(CustomError::PubkeyMismatch.into())
    } else {
        Ok(())
    }
}

pub fn assert_initialized<T: Pack + IsInitialized>(
    account_info: &AccountInfo,
) -> Result<T, ProgramError> {
    let account: T = T::unpack_unchecked(&account_info.data.borrow())?;
    if !account.is_initialized() {
        msg!("Validation failed: account not initialized");
        Err(CustomError::UninitializedAccount.into())
    } else {
        Ok(account)
    }
}

pub fn assert_owned_by(account: &AccountInfo, owner: &Pubkey) -> ProgramResult {
    if account.owner != owner {
        msg!("Validation failed: wrong account owner");
        Err(CustomError::AccountOwnerMismatch.into())
    } else {
        Ok(())
    }
}

pub fn floor_divide(x: i64, y: usize) -> i64 {
    if x >= 0{
        return x / y as i64;
    }
    else {
        let mut ans = x / y as i64;
        if x % y as i64 != 0{
            ans -= 1;
        }
        return ans;
    }
}

pub fn get_neighborhood_xy(x: i64, y: i64) -> (i64, i64) {
    (floor_divide(x, NEIGHBORHOOD_SIDE), floor_divide(y, NEIGHBORHOOD_SIDE))
}

pub fn get_index(sx: i64, sy: i64) -> usize {
    let (nx, ny) = get_neighborhood_xy(sx, sy);
    let snx: usize = (sx - nx * NEIGHBORHOOD_SIDE as i64).try_into().unwrap();
    let sny: usize = (sy - ny * NEIGHBORHOOD_SIDE as i64).try_into().unwrap();
    snx * NEIGHBORHOOD_SIDE + sny
}

pub fn color_to_side(c: Color) -> Side {
    match c {
        Color::WHITE => Side::White,
        Color::BLACK => Side::Black,
    }
}

pub fn side_to_color(s: Side) -> Color {
    match s {
        Side::White => Color::WHITE,
        Side::Black => Color::BLACK,
        Side::Undefined => panic!("Cannot convert undefined to legal_chess color"),
    }
}

pub fn display_game(g: &Game) {
    for rnk in 1..=8 {
        let mut row = "".to_owned();
        for fil in 1..=8 {
            let pos = position::Position(fil, rnk);
            row.push(match g.board().get_square(pos) {
                None => '.',
                Some(p) => match (**p).piece() {
                    PieceEnum::PAWN => 'p',
                    PieceEnum::KNIGHT => 'N',
                    PieceEnum::BISHOP => 'B',
                    PieceEnum::ROOK => 'R',
                    PieceEnum::QUEEN => 'Q',
                    PieceEnum::KING => 'K',
                }
            })
        }
        msg!(&row);
    }
    msg!("To move: {:?}", g.side_to_move());
}

pub fn mod_ply(ply: u16) -> u8 {
    (ply % 256) as u8
}

pub fn has_voted(p: &Vote, c: &Vote) -> bool {
    p.idx == c.idx && p.ply == c.ply
}

pub const ZERO_LEN: u32 = 0;
pub fn reset_votes(board_data: &mut &mut [u8]) -> ProgramResult {
    let start = Board::LEN;
    let votes_len_data = &mut (&mut board_data[start..start+size_of::<u32>()]);
    ZERO_LEN.serialize(votes_len_data)?;
    Ok(())
}

pub enum Dir {
    Upvote = 1,
    Downvote = -1,
}

pub fn update_vote(board_data: &mut &mut [u8], v: &Vote, vote_direction: Dir) -> ProgramResult {
    let start = Board::LEN;
    let votes_len: usize = try_from_slice_unchecked(&board_data[start..start+size_of::<usize>()])?;
    for i in 0..votes_len {
        let vc_start = Board::LEN + i as usize * size_of::<VoteCount>();
        let mut vote_count: VoteCount = try_from_slice_unchecked(&board_data[vc_start..vc_start+size_of::<VoteCount>()])?;
        if &vote_count.vote == v {
            vote_count.count += 1;
            vote_count.serialize(&mut (&mut board_data[vc_start..vc_start+size_of::<VoteCount>()]))?;
            return Ok(());
        }
    }
    match vote_direction {
        Dir::Upvote => {
            let votes_len_data = &mut (&mut board_data[start..start+size_of::<usize>()]);
            (votes_len+1).serialize(votes_len_data)?;
            let vc_start = Board::LEN + votes_len * size_of::<VoteCount>();
            let vote_count_data = &mut (&mut board_data[vc_start..vc_start+size_of::<VoteCount>()]);
            VoteCount {vote: *v, count: 0}.serialize(vote_count_data)?;
            Ok(())
        },
        Dir::Downvote => panic!("Vote not found in tally"),
    }
}

pub fn tally_winner(board_data: &mut &mut [u8]) -> Result<VoteCount, ProgramError> {
    let mut leader = VoteCount::empty();
    let mut vc: VoteCount;
    let start = Board::LEN;
    let votes_len: usize = try_from_slice_unchecked(&board_data[start..start+size_of::<usize>()])?;
    for i in 0..votes_len {
        let vc_start = Board::LEN + i as usize * size_of::<VoteCount>();
        vc = try_from_slice_unchecked(&board_data[vc_start..vc_start+size_of::<VoteCount>()])?;
        if vc.count > leader.count {
            leader = vc;
        }
    }
    Ok(leader)
}
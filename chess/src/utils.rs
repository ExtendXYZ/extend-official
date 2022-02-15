use borsh::BorshSerialize;
use solana_program::{
    account_info::AccountInfo,
    borsh::try_from_slice_unchecked,
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack},
    pubkey::Pubkey,
    sysvar::Sysvar,
};
use legal_chess::{
    color::Color,
    game::Game,
    pieces::{piece::PieceEnum, position},
};
use std::{
    convert::TryInto,
    mem::size_of,
    str::FromStr,
};
use spl_associated_token_account::get_associated_token_address;
use spl_token;
use spl_token::state::Account;

use super::error::CustomError;
use crate::state::{
    Side,
    Vote,
    VoteCount,
    NEIGHBORHOOD_SIDE,
    TALLY_START,
    TALLY_VOTE_START,
    // Space check
    SPACE_PID,
    SPACE_METADATA_SEED,
    SpaceMetadata,
    Space,
};

pub fn assert_is_ata(ata: &AccountInfo, wallet: &Pubkey, mint: &Pubkey) -> ProgramResult {
    assert_owned_by(ata, &spl_token::id())?;
    let ata_account: Account = assert_initialized(ata)?;
    assert_keys_equal(ata_account.owner, *wallet)?;
    assert_keys_equal(get_associated_token_address(wallet, mint), *ata.key)?;
    Ok(())
}

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

pub fn assert_valid_owned_space(
    base: &AccountInfo,
    space_owner: &AccountInfo,
    space_metadata: &AccountInfo,
    space_ata: &AccountInfo,
    space: &Space,
) -> ProgramResult {
    // Verify space metadata
    let space_metadata_data: SpaceMetadata = try_from_slice_unchecked(&space_metadata.data.borrow())?;
    let seeds_space_metadata = &[
        &base.key.to_bytes(),
        SPACE_METADATA_SEED,
        &space.x.to_le_bytes(),
        &space.y.to_le_bytes(),
        &[space_metadata_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_space_metadata, &Pubkey::from_str(SPACE_PID).unwrap())?;
    assert_keys_equal(key, *space_metadata.key)?;

    // Check ATAs
    assert_is_ata(space_ata, space_owner.key, &space_metadata_data.mint)?;

    // Verify token is owned
    let space_ata_data = spl_token::state::Account::unpack_from_slice(&space_ata.data.borrow())?;
    if space_ata_data.amount != 1 {
        msg!("Error: token account does not own token");
        return Err(CustomError::MissingTokenOwner.into());
    }

    Ok(())
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

pub fn now_ts() -> u64 { Clock::get().unwrap().unix_timestamp as u64 }

pub fn mod_ply(ply: u16) -> u8 {
    (ply % 256) as u8
}

pub fn has_voted(p: &Vote, c: &Vote) -> bool {
    p.idx == c.idx && p.ply == c.ply
}

pub const ZERO_LEN: usize = 0;
pub fn reset_votes(board_data: &mut &mut [u8]) -> ProgramResult {
    Ok(ZERO_LEN.serialize(&mut &mut board_data[TALLY_START..TALLY_START+size_of::<usize>()])?)
}

pub enum Dir {
    Upvote = 1,
    Downvote = -1,
}
pub fn update_vote(board_data: &mut &mut [u8], v: &Vote, vote_direction: Dir) -> ProgramResult {
    let votes_len: usize = try_from_slice_unchecked(&board_data[TALLY_START..TALLY_START+size_of::<usize>()])?;
    for i in 0..votes_len {
        let vc_start = TALLY_VOTE_START + i as usize * size_of::<VoteCount>();
        let mut vote_count: VoteCount = try_from_slice_unchecked(&board_data[vc_start..vc_start+size_of::<VoteCount>()])?;
        if &vote_count.vote == v {
            vote_count.count += 1;
            vote_count.serialize(&mut &mut board_data[vc_start..vc_start+size_of::<VoteCount>()])?;
            return Ok(());
        }
    }
    match vote_direction {
        Dir::Upvote => {
            (votes_len+1).serialize(&mut &mut board_data[TALLY_START..TALLY_START+size_of::<usize>()])?;
            let vc_start = TALLY_VOTE_START + votes_len * size_of::<VoteCount>();
            VoteCount {vote: *v, count: 1}.serialize(&mut &mut board_data[vc_start..vc_start+size_of::<VoteCount>()])?;
            Ok(())
        },
        Dir::Downvote => panic!("Vote not found in tally"),
    }
}

pub fn tally_winner(board_data: &mut &mut [u8]) -> Result<VoteCount, ProgramError> {
    let mut leader = VoteCount::empty();
    let mut vc: VoteCount;
    let votes_len: usize = try_from_slice_unchecked(&board_data[TALLY_START..TALLY_START+size_of::<usize>()])?;
    msg!("Distinct votes: {:?}", votes_len);
    for i in 0..votes_len {
        let vc_start = TALLY_VOTE_START + i as usize * size_of::<VoteCount>();
        vc = try_from_slice_unchecked(&board_data[vc_start..vc_start+size_of::<VoteCount>()])?;
        if vc.count > leader.count {
            leader = vc;
        }
    }
    Ok(leader)
}